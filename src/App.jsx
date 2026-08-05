import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import InstructionsPage from "./pages/InstructionsPage.jsx";
import RulesPage from "./pages/RulesPage.jsx";
import RunPage from "./pages/RunPage.jsx";
import SkillsPage from "./pages/SkillsPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="run" element={<RunPage />} />
          <Route path="instructions" element={<InstructionsPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
