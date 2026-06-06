import { Routes, Route, Navigate } from "react-router-dom"

import { Layout } from "@/components/Layout"
import { UploadPage } from "@/pages/UploadPage"
import { InteractivePage } from "@/pages/InteractivePage"
import { BatchPage } from "@/pages/BatchPage"
import { ResultsPage } from "@/pages/ResultsPage"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/interactive" replace />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/interactive" element={<InteractivePage />} />
        <Route path="/batch" element={<BatchPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/interactive" replace />} />
      </Route>
    </Routes>
  )
}
