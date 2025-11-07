import { useState } from "react";
import AuthLanding from "./pages/AuthLanding.jsx";
import CovenantApp from "./CovenantApp.jsx";

export default function App() {
  const [session, setSession] = useState(null);

  if (!session) {
    return <AuthLanding onAuthenticated={setSession} />;
  }

  return <CovenantApp user={session} onSignOut={() => setSession(null)} />;
}
