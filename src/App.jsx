import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { ApiStatusProvider } from "./context/ApiStatusContext.jsx";
import AboutMePage from "./pages/AboutMePage.jsx";
import AgentsPage from "./pages/AgentsPage.jsx";
import AnalysisPage from "./pages/AnalysisPage.jsx";
import DbExplorerPage from "./pages/DbExplorerPage.jsx";
import DocsPage from "./pages/DocsPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import RulesPage from "./pages/RulesPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SkillsPage from "./pages/SkillsPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <ApiStatusProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<AnalysisPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="run" element={<Navigate to="/" replace />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="db-explorer" element={<DbExplorerPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="about-me" element={<AboutMePage />} />
            <Route path="instructions" element={<Navigate to="/rules" replace />} />
            <Route path="admin" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ApiStatusProvider>
    </BrowserRouter>
  );
}
