import { Outlet } from "react-router-dom";
import { useColorMode } from "@chakra-ui/react";
import clsx from "clsx";

import { COLOR_MODE } from "@/constants";

import styles from "./index.module.scss";

export default function LoginReg() {
  const { colorMode } = useColorMode();
  const darkMode = colorMode === COLOR_MODE.dark;
  return (
    <div
      className={clsx(styles.container, { "bg-[#edf1f5]": !darkMode, "bg-lafDark-300": darkMode })}
    >
      {/* <div className="absolute left-[120px] top-[120px]">
        <div
          className={clsx("text-[36px]", {
            "text-primary-600": !darkMode,
            "text-primary-400": darkMode,
          })}
        >
          <div className="mb-[45px]">
            <img src="/logo_light.png" alt="logo" width={178} className="mr-4" />
          </div>
        </div>
        <div
          className={clsx("text-[20px]", {
            "text-grayModern-500": !darkMode,
            "text-grayModern-300": darkMode,
          })}
        >
          Welcome to Smart Campus
        </div>
      </div> */}
      <Outlet />
    </div>
  );
}
