import { useEffect, useState } from "react";
import { AiFillGithub } from "react-icons/ai";
import { Button, useColorMode } from "@chakra-ui/react";
import clsx from "clsx";
import { t } from "i18next";

import { COLOR_MODE } from "@/constants";

import LoginByGoogle from "./mods/LoginByGoogle";
import LoginByPasswordPanel from "./mods/LoginByPasswordPanel";
import LoginByPhonePanel from "./mods/LoginByPhonePanel";

import { useGetProvidersQuery } from "@/pages/auth/service";
import useAuthStore from "@/pages/auth/store";

type providersTypes = "user-password" | "phone" | "github" | "wechat" | "google";

export default function SignIn() {
  const { colorMode } = useColorMode();
  const darkMode = colorMode === COLOR_MODE.dark;
  const { providers, setProviders } = useAuthStore();
  useGetProvidersQuery((data: any) => {
    setProviders(data?.data || []);
  });
  const [phoneProvider, setPhoneProvider] = useState<any>(null);
  const [passwordProvider, setPasswordProvider] = useState<any>(null);
  const [githubProvider, setGithubProvider] = useState<any>(null);
  const [googleProvider, setGoogleProvider] = useState<any>(null);
  const [wechatProvider, setWechatProvider] = useState<any>(null);
  const [currentProvider, setCurrentProvider] = useState<providersTypes>();
  useEffect(() => {
    if (providers.length) {
      const phoneProvider = providers.find((provider: any) => provider.name === "phone");
      const passwordProvider = providers.find((provider: any) => provider.name === "user-password");
      const githubProvider = providers.find((provider: any) => provider.name === "github");
      const googleProvider = providers.find((provider: any) => provider.name === "google");

      setPhoneProvider(phoneProvider);
      setPasswordProvider(passwordProvider);
      setGithubProvider(githubProvider);
      setGoogleProvider(googleProvider);
      setWechatProvider(wechatProvider);

      providers.forEach((provider: any) => {
        if (provider.default) {
          setCurrentProvider(provider.name);
        }
      });
    }
  }, [providers, wechatProvider]);

  return (
    <div
      className={clsx(
        "absolute left-1/2 top-1/2 min-h-[500px] w-[560px] -translate-y-1/2 rounded-[10px] p-[65px] pb-[100px]",
        {
          "bg-lafDark-100": darkMode,
          "bg-white": !darkMode,
        },
      )}
    >
      <div
        className={clsx("pb-[30px] text-[24px]", {
          "text-primary-600": !darkMode,
          "text-primary-400": darkMode,
        })}
      >
        Welcome to Smart Campus
      </div>

      {currentProvider === "phone" ? (
        <LoginByPhonePanel
          showPasswordSigninBtn={!!passwordProvider}
          switchLoginType={() => setCurrentProvider("user-password")}
        />
      ) : currentProvider === "user-password" ? (
        <LoginByPasswordPanel
          showSignupBtn={!!passwordProvider?.register}
          showPhoneSigninBtn={!!phoneProvider}
          switchLoginType={() => setCurrentProvider("phone")}
        />
      ) : null}

      {(googleProvider || githubProvider || wechatProvider) && (
        <div className="mt-20">
          <div className="relative mb-5 w-full text-center before:absolute before:top-1/2 before:block before:h-[1px] before:w-full before:bg-slate-300 before:content-['']">
            <span className="relative z-10 bg-white pl-5 pr-5">or</span>
          </div>
          {githubProvider && (
            <Button type="submit" className="w-full pb-5 pt-5" colorScheme="white" variant="plain">
              <AiFillGithub className="mr-4" />
              {t("AuthPanel.LoginWithGithub")}
            </Button>
          )}

          {googleProvider && (
            <LoginByGoogle
              showPasswordSigninBtn={!!passwordProvider}
              switchLoginType={() => setCurrentProvider("google")}
            />
          )}
        </div>
      )}
    </div>
  );
}
