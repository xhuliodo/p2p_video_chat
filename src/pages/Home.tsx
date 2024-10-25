import { useEffect, useState } from "react";
import { v7 } from "uuid";
import { useLocation, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";

export const Home = () => {
  // used to notify user of call details after redirect
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state?.message) {
      toast(location.state?.message);

      // Use 'replace' to update the state without causing a navigation event
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.message, location.pathname, navigate]);

  const [passphrase, setPassphrase] = useState(v7());
  const [error, setError] = useState("");
  const regex = /^[a-zA-Z0-9-]+$/;
  const handlePassphrase = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPassphrase = event.target.value;
    setPassphrase(newPassphrase);
    if (!newPassphrase.length) {
      setError("The passphrase cannot be empty");
      return;
    }
    if (newPassphrase.length > 50) {
      setError("The passphrase can be at most 50 characters long");
      return;
    }
    if (!regex.exec(newPassphrase)) {
      setError("The passphrase can only contain letters, numbers and '-'.");
      return;
    }

    setError("");
  };

  const onClickStart = () => {
    navigate(`/calls/${passphrase}`);
  };

  return (
    <div className="h-dvh w-screen">
      <div className="flex h-full flex-col items-center justify-center bg-[#008B8B] gap-5">
        <img className="-mb-7" src="logo.svg" />
        <div className="flex w-[80%] flex-col items-center justify-center">
          <span className="text-center text-5xl text-white md:text-7xl">
            Video chat{" "}
            <b className="drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.5)]">
              securily
            </b>{" "}
            directly on your browser
          </span>
        </div>
        <div className="flex w-full flex-col items-center justify-center">
          <div className="flex w-[80%] flex-col items-center justify-center gap-5">
            <input
              type="text"
              name="passphrase"
              placeholder="Type a secure passphrase or just start"
              className="h-12 w-full max-w-sm text-center text-lg placeholder:text-sm"
              onChange={handlePassphrase}
            />
            <p className="text-red-900">{error}</p>
            <button
              name="start"
              onClick={onClickStart}
              disabled={!!error}
              className={`w-full max-w-sm rounded-lg bg-[#FFA500] p-3 text-2xl font-semibold text-white ${
                error && "bg-gray-700"
              }`}
            >
              Start
            </button>
          </div>
        </div>
      </div>
      <ToastContainer
        position="top-center"
        style={{ width: "80%" }}
        progressStyle={{ background: "gray" }}
        limit={3}
      />
    </div>
  );
};
