import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      richColors
      toastOptions={{
        classNames: {
          toast: "!border-white/8 !bg-[#10101c] !text-[#e8e8f0]",
          title: "!text-[#e8e8f0]",
          description: "!text-[#8888a0]",
        },
      }}
    />
  );
}
