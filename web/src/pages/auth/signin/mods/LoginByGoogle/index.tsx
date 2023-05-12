import { useNavigate } from "react-router-dom";
import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

import { Routes } from "@/constants";

import { useSigninByGoogleMutation } from "@/pages/auth/service";

export default function LoginByGoogle({
  switchLoginType,
  showPasswordSigninBtn,
}: {
  switchLoginType: () => void;
  showPasswordSigninBtn: boolean;
}) {
  const navigate = useNavigate();
  const signinByGoogleMutation = useSigninByGoogleMutation();

  const onSuccess = async (data: CredentialResponse) => {
    const res = await signinByGoogleMutation.mutateAsync({
      clientId: data.clientId,
      credential: data.credential,
    });

    if (res?.data) {
      navigate(Routes.dashboard, { replace: true });
    }
  };

  return (
    <GoogleOAuthProvider clientId="401622965544-sndvjq1m6kfh6fspqq9b2vkft1e57uga.apps.googleusercontent.com">
      <div className="flex items-center justify-center">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={() => {
            console.log("Login Failed");
          }}
          useOneTap
        />
      </div>
    </GoogleOAuthProvider>
  );
}
