import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { InvoiceListPage } from './pages/invoices/InvoiceListPage';
import { InvoiceDetailPage } from './pages/invoices/InvoiceDetailPage';
import { NewInvoicePage } from './pages/invoices/NewInvoicePage';
import { EstimatesPage } from './pages/estimates/EstimatesPage';
import { EstimateDetailPage } from './pages/estimates/EstimateDetailPage';
import { ClientsPage } from './pages/clients/ClientsPage';
import { ClientDetailPage } from './pages/clients/ClientDetailPage';
import { CreditNotesPage } from './pages/credit-notes/CreditNotesPage';
import { ReportsPage } from './pages/reports/ReportsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/new" element={<NewInvoicePage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/estimates" element={<EstimatesPage />} />
          <Route path="/estimates/:id" element={<EstimateDetailPage />} />
          <Route path="/credit-notes" element={<CreditNotesPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
