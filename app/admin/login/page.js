"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const router = useRouter();

  async function login(e) {
    e.preventDefault();

    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username,
  password }),
    });

    const data = await res.json();

    if (data.ok) {
      router.push("/admin");
    } else {
      setError("Wrong Username or password");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper">
      <form
        onSubmit={login}
        className="bg-panel border border-line rounded-2xl p-6 w-[400px] shadow-card"
      >
        <h1 className="text-3xl font-bold mb-2">
          SliceMatic Admin
        </h1>

        <p className="text-sm text-muted mb-5">
          Enter your password to continue.
        </p>

        <input
          type="password"
          placeholder="Password"
          className="w-full border border-line rounded-xl px-3 py-3 mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="text-red-500 mb-4">{error}</p>
        )}

        <button className="w-full bg-brand rounded-xl py-3 text-white font-semibold">
          Login
        </button>
      </form>
    </main>
  );
}