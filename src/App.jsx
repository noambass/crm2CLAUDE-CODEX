import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from '@/pages/Login';
import JobForm from '@/pages/JobForm';
import JobDetails from '@/pages/JobDetails';
import ClientForm from '@/pages/ClientForm';
import QuoteForm from '@/pages/QuoteForm';
import QuoteDetails from '@/pages/QuoteDetails';
import Clients from '@/pages/Clients';
import Jobs from '@/pages/Jobs';
import Quotes from '@/pages/Quotes';


const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const EXCLUDED_PAGE_ROUTES = new Set(['JobForm', 'JobDetails', 'ClientForm', 'QuoteForm', 'QuoteDetails']);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not logged in -> show Login page
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Logged in -> render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      <Route
        path="/jobs"
        element={
          <LayoutWrapper currentPageName="Jobs">
            <Jobs />
          </LayoutWrapper>
        }
      />
      <Route
        path="/jobs/new"
        element={
          <LayoutWrapper currentPageName="Jobs">
            <JobForm />
          </LayoutWrapper>
        }
      />
      <Route
        path="/jobs/:id"
        element={
          <LayoutWrapper currentPageName="Jobs">
            <JobDetails />
          </LayoutWrapper>
        }
      />
      <Route
        path="/clients"
        element={
          <LayoutWrapper currentPageName="Clients">
            <Clients />
          </LayoutWrapper>
        }
      />
      <Route
        path="/clients/new"
        element={
          <LayoutWrapper currentPageName="Clients">
            <ClientForm />
          </LayoutWrapper>
        }
      />
      <Route
        path="/clients/:id"
        element={
          <LayoutWrapper currentPageName="Clients">
            <ClientForm />
          </LayoutWrapper>
        }
      />
      <Route
        path="/quotes"
        element={
          <LayoutWrapper currentPageName="Quotes">
            <Quotes />
          </LayoutWrapper>
        }
      />
      <Route
        path="/quotes/new"
        element={
          <LayoutWrapper currentPageName="Quotes">
            <QuoteForm />
          </LayoutWrapper>
        }
      />
      <Route
        path="/quotes/:id"
        element={
          <LayoutWrapper currentPageName="Quotes">
            <QuoteDetails />
          </LayoutWrapper>
        }
      />
      <Route
        path="/quotes/:id/edit"
        element={
          <LayoutWrapper currentPageName="Quotes">
            <QuoteForm />
          </LayoutWrapper>
        }
      />
      <Route
        path="/QuoteForm"
        element={
          <LayoutWrapper currentPageName="Quotes">
            <QuoteForm />
          </LayoutWrapper>
        }
      />
      <Route
        path="/QuoteDetails"
        element={
          <LayoutWrapper currentPageName="Quotes">
            <QuoteDetails />
          </LayoutWrapper>
        }
      />
      {Object.entries(Pages)
        .filter(([path]) => !EXCLUDED_PAGE_ROUTES.has(path))
        .map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};



function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
