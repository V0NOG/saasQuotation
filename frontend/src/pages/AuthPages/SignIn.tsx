import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {

  const googleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/api/auth/google`;
  };


  return ( 
    <>
      <PageMeta
        title="React.js SignIn Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js SignIn Tables Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
      <button
        type="button"
        onClick={googleLogin}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black hover:bg-gray-1 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-meta-4"
      >
        Continue with Google
      </button>
    </>
  );
}
