import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Application, ApplicationPhase, ApplicationState } from '@prisma/client'
import { isConditionTrue } from '../utils/getter'
import { InstanceService } from './instance.service'
import { ServerConfig, TASK_LOCK_INIT_TIME } from 'src/constants'
import { SystemDatabase } from 'src/database/system-database'
import { CronJobService } from 'src/trigger/cron-job.service'

@Injectable()
export class InstanceTaskService {
  readonly lockTimeout = 10 // in second
  private readonly logger = new Logger(InstanceTaskService.name)

  constructor(
    private readonly instanceService: InstanceService,
    private readonly cronService: CronJobService,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async tick() {
    if (ServerConfig.DISABLED_INSTANCE_TASK) {
      return
    }

    // Phase `Created` | `Stopped` ->  `Starting`
    this.handleRunningState().catch((err) => {
      this.logger.error('handleRunningState error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })

    // Phase `Starting` -> `Started`
    this.handleStartingPhase().catch((err) => {
      this.logger.error('handleStartingPhase error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })

    // Phase `Started` -> `Stopping`
    this.handleStoppedState().catch((err) => {
      this.logger.error('handleStoppedState error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })

    // Phase `Stopping` -> `Stopped`
    this.handleStoppingPhase().catch((err) => {
      this.logger.error('handleStoppingPhase error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })

    // Phase `Started` -> `Starting`
    this.handleRestartingState().catch((err) => {
      this.logger.error('handleRestartingPhase error', err)
      err?.response && this.logger.debug(err?.response?.data || err?.response)
    })
  }

  /**
   * State `Running`:
   * - move phase `Created` or `Stopped` to `Starting`
   */
  async handleRunningState() {
    const db = SystemDatabase.db

    await db.collection<Application>('Application').updateMany(
      {
        state: ApplicationState.Running,
        phase: { $in: [ApplicationPhase.Created, ApplicationPhase.Stopped] },
        lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
      },
      {
        $set: {
          phase: ApplicationPhase.Starting,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Phase `Starting`:
   * - waiting for instance to be available
   * - move phase to `Started`
   */
  async handleStartingPhase() {
    const db = SystemDatabase.db

    const res = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        {
          phase: ApplicationPhase.Starting,
          lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
        },
        { $set: { lockedAt: new Date() } },
      )

    if (!res.value) return
    const app = res.value

    // create instance
    await this.instanceService.create(app)

    // if waiting time is more than 5 minutes, stop the application
    const waitingTime = Date.now() - app.updatedAt.getTime()
    if (waitingTime > 1000 * 60 * 5) {
      await db.collection<Application>('Application').updateOne(
        { appid: app.appid, phase: ApplicationPhase.Starting },
        {
          $set: {
            state: ApplicationState.Stopped,
            phase: ApplicationPhase.Started,
            lockedAt: TASK_LOCK_INIT_TIME,
            updatedAt: new Date(),
          },
        },
      )

      this.logger.log(`${app.appid} updated to state Stopped due to timeout`)
      return
    }

    const appid = app.appid
    const instance = await this.instanceService.get(app)
    const unavailable =
      instance.deployment?.status?.unavailableReplicas || false
    if (unavailable) {
      await this.relock(appid, waitingTime)
      return
    }

    const available = isConditionTrue(
      'Available',
      instance.deployment?.status?.conditions || [],
    )
    if (!available) {
      await this.relock(appid, waitingTime)
      return
    }

    if (!instance.service) {
      await this.relock(appid, waitingTime)
      return
    }

    // resume cronjobs if any
    await this.cronService.resumeAll(app.appid)

    // if state is `Restarting`, update state to `Running` with phase `Started`
    let toState = app.state
    if (app.state === ApplicationState.Restarting) {
      toState = ApplicationState.Running
    }

    // update application state
    await db.collection<Application>('Application').updateOne(
      { appid, phase: ApplicationPhase.Starting },
      {
        $set: {
          state: toState,
          phase: ApplicationPhase.Started,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )

    this.logger.debug(`Application ${app.appid} updated to phase started`)
  }

  /**
   * State `Stopped`:
   * - move phase `Started` to `Stopping`
   */
  async handleStoppedState() {
    const db = SystemDatabase.db

    await db.collection<Application>('Application').updateMany(
      {
        state: ApplicationState.Stopped,
        phase: ApplicationPhase.Started,
        lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
      },
      {
        $set: {
          lockedAt: TASK_LOCK_INIT_TIME,
          phase: ApplicationPhase.Stopping,
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Phase `Stopping`:
   * - waiting for instance to be removed
   * - move phase `Stopping` to `Stopped`
   */
  async handleStoppingPhase() {
    const db = SystemDatabase.db

    const res = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        {
          phase: ApplicationPhase.Stopping,
          lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
        },
        { $set: { lockedAt: new Date() } },
      )

    if (!res.value) return
    const app = res.value
    const appid = app.appid

    const waitingTime = Date.now() - app.updatedAt.getTime()

    // check if the instance is removed
    const instance = await this.instanceService.get(app)
    if (instance.deployment) {
      await this.instanceService.remove(app)
      await this.relock(appid, waitingTime)
      return
    }

    // check if the service is removed
    if (instance.service) {
      await this.instanceService.remove(app)
      await this.relock(appid, waitingTime)
      return
    }

    // suspend cronjobs if any
    await this.cronService.suspendAll(app.appid)

    // update application phase to `Stopped`
    await db.collection<Application>('Application').updateOne(
      { appid, phase: ApplicationPhase.Stopping },
      {
        $set: {
          phase: ApplicationPhase.Stopped,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )

    this.logger.log(`Application ${app.appid} updated to phase Stopped`)
  }

  /**
   * State `Restarting`:
   * - move phase `Started` to `Starting`
   */
  async handleRestartingState() {
    const db = SystemDatabase.db

    const res = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        {
          state: ApplicationState.Restarting,
          phase: ApplicationPhase.Started,
          lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
        },
        { $set: { lockedAt: new Date() } },
      )

    if (!res.value) return
    const app = res.value

    await this.instanceService.restart(app.appid)

    // update application phase to `Starting`
    await db.collection<Application>('Application').updateOne(
      { appid: app.appid, phase: ApplicationPhase.Started },
      {
        $set: {
          phase: ApplicationPhase.Starting,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )
    this.logger.log(`Application ${app.appid} updated to phase Starting`)
  }

  /**
   * Relock application by appid, lockedTime is in milliseconds
   */
  async relock(appid: string, lockedTime = 0) {
    // if lockedTime greater than 3 minutes, set it to 3 minutes
    if (lockedTime > 3 * 60 * 1000) {
      lockedTime = 3 * 60 * 1000
    }

    const db = SystemDatabase.db
    const lockedAt = new Date(Date.now() - 1000 * this.lockTimeout + lockedTime)
    await db
      .collection<Application>('Application')
      .updateOne({ appid: appid }, { $set: { lockedAt } })
  }
}
