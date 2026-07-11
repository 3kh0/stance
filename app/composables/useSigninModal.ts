export type SigninMode = "choose" | "paper" | "wallet";

export const useSigninModal = () => {
  const isOpen = useState<boolean>("signin-modal-open", () => false);
  const mode = useState<SigninMode>("signin-modal-mode", () => "choose");
  return {
    isOpen,
    mode,
    openSignin: (m: SigninMode = "choose") => {
      mode.value = m;
      isOpen.value = true;
    },
    closeSignin: () => (isOpen.value = false),
  };
};
