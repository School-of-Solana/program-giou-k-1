"use client";

import dynamic from "next/dynamic";

const MessageBoard = dynamic(() => import("@/components/MessageBoard"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      <MessageBoard />
    </div>
  );
}
