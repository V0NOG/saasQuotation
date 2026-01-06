// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import RequireAuth from "./components/auth/RequireAuth";
import { ScrollToTop } from "./components/common/ScrollToTop";

import AppLayout from "./layout/AppLayout";
import AlternativeLayout from "./layout/AlternativeLayout";

import OAuthCallBack from "./pages/AuthPages/OAuthCallBack";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import TwoStepVerification from "./pages/AuthPages/TwoStepVerification";

import NotFound from "./pages/OtherPage/NotFound";
import Maintenance from "./pages/OtherPage/Maintenance";
import Success from "./pages/OtherPage/Success";
import FiveZeroZero from "./pages/OtherPage/FiveZeroZero";
import FiveZeroThree from "./pages/OtherPage/FiveZeroThree";
import ComingSoon from "./pages/OtherPage/ComingSoon";

import Ecommerce from "./pages/Dashboard/Ecommerce";
import Stocks from "./pages/Dashboard/Stocks";
import Crm from "./pages/Dashboard/Crm";
import Marketing from "./pages/Dashboard/Marketing";
import Analytics from "./pages/Dashboard/Analytics";
import Saas from "./pages/Dashboard/Saas";
import Logistics from "./pages/Dashboard/Logistics";

import Calendar from "./pages/Calendar";
import Invoices from "./pages/Invoices";
import Chats from "./pages/Chat/Chats";
import FileManager from "./pages/FileManager";
import UserProfiles from "./pages/UserProfiles";
import Faqs from "./pages/Faqs";
import PricingTables from "./pages/PricingTables";
import Integrations from "./pages/OtherPage/Integrations";
import ApiKeys from "./pages/OtherPage/ApiKeys";
import Blank from "./pages/Blank";

import ProductList from "./pages/Ecommerce/ProductList";
import AddProduct from "./pages/Ecommerce/AddProduct";
import Billing from "./pages/Ecommerce/Billing";
import SingleInvoice from "./pages/Ecommerce/SingleInvoice";
import CreateInvoice from "./pages/Ecommerce/CreateInvoice";
import Transactions from "./pages/Ecommerce/Transactions";
import SingleTransaction from "./pages/Ecommerce/SingleTransaction";

import TicketList from "./pages/Support/TicketList";
import TicketReply from "./pages/Support/TicketReply";

import EmailInbox from "./pages/Email/EmailInbox";
import EmailDetails from "./pages/Email/EmailDetails";

import BasicTables from "./pages/Tables/BasicTables";
import DataTables from "./pages/Tables/DataTables";

import Alerts from "./pages/UiElements/Alerts";
import Avatars from "./pages/UiElements/Avatars";
import Badges from "./pages/UiElements/Badges";
import BreadCrumb from "./pages/UiElements/BreadCrumb";
import Buttons from "./pages/UiElements/Buttons";
import ButtonsGroup from "./pages/UiElements/ButtonsGroup";
import Cards from "./pages/UiElements/Cards";
import Carousel from "./pages/UiElements/Carousel";
import Dropdowns from "./pages/UiElements/Dropdowns";
import Images from "./pages/UiElements/Images";
import Links from "./pages/UiElements/Links";
import Lists from "./pages/UiElements/Lists";
import Modals from "./pages/UiElements/Modals";
import Notifications from "./pages/UiElements/Notifications";
import Pagination from "./pages/UiElements/Pagination";
import Popovers from "./pages/UiElements/Popovers";
import Progressbar from "./pages/UiElements/Progressbar";
import Ribbons from "./pages/UiElements/Ribbons";
import Spinners from "./pages/UiElements/Spinners";
import Tabs from "./pages/UiElements/Tabs";
import Tooltips from "./pages/UiElements/Tooltips";
import Videos from "./pages/UiElements/Videos";

import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import PieChart from "./pages/Charts/PieChart";

import TaskList from "./pages/Task/TaskList";
import TaskKanban from "./pages/Task/TaskKanban";

import TextGeneratorPage from "./pages/Ai/TextGenerator";
import ImageGeneratorPage from "./pages/Ai/ImageGenerator";
import CodeGeneratorPage from "./pages/Ai/CodeGenerator";
import VideoGeneratorPage from "./pages/Ai/VideoGenerator";

export default function App() {
  return (
    <Router>
      <ScrollToTop />

      <Routes>
        {/* PUBLIC auth pages */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/two-step-verification" element={<TwoStepVerification />} />
        <Route path="/auth/callback" element={<OAuthCallBack />} />

        {/* PUBLIC special pages */}
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/success" element={<Success />} />
        <Route path="/five-zero-zero" element={<FiveZeroZero />} />
        <Route path="/five-zero-three" element={<FiveZeroThree />} />
        <Route path="/coming-soon" element={<ComingSoon />} />

        {/* PUBLIC Alternative Layout */}
        <Route element={<AlternativeLayout />}>
          <Route path="/text-generator" element={<TextGeneratorPage />} />
          <Route path="/image-generator" element={<ImageGeneratorPage />} />
          <Route path="/code-generator" element={<CodeGeneratorPage />} />
          <Route path="/video-generator" element={<VideoGeneratorPage />} />
        </Route>

        {/* PROTECTED app */}
        <Route
          route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Ecommerce />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/crm" element={<Crm />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/saas" element={<Saas />} />
          <Route path="/logistics" element={<Logistics />} />

          <Route path="/calendar" element={<Calendar />} />
          <Route path="/invoice" element={<Invoices />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/chat" element={<Chats />} />
          <Route path="/file-manager" element={<FileManager />} />

          {/* E-commerce */}
          <Route path="/products-list" element={<ProductList />} />
          <Route path="/add-product" element={<AddProduct />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/single-invoice" element={<SingleInvoice />} />
          <Route path="/create-invoice" element={<CreateInvoice />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/single-transaction" element={<SingleTransaction />} />

          {/* Support */}
          <Route path="/support-tickets" element={<TicketList />} />
          <Route path="/support-ticket-reply" element={<TicketReply />} />

          {/* Profile / Other */}
          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/faq" element={<Faqs />} />
          <Route path="/pricing-tables" element={<PricingTables />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/api-keys" element={<ApiKeys />} />
          <Route path="/blank" element={<Blank />} />

          {/* Tables */}
          <Route path="/basic-tables" element={<BasicTables />} />
          <Route path="/data-tables" element={<DataTables />} />

          {/* Email */}
          <Route path="/inbox" element={<EmailInbox />} />
          <Route path="/inbox-details" element={<EmailDetails />} />

          {/* Tasks */}
          <Route path="/task-list" element={<TaskList />} />
          <Route path="/task-kanban" element={<TaskKanban />} />

          {/* UI */}
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/avatars" element={<Avatars />} />
          <Route path="/badge" element={<Badges />} />
          <Route path="/breadcrumb" element={<BreadCrumb />} />
          <Route path="/buttons" element={<Buttons />} />
          <Route path="/buttons-group" element={<ButtonsGroup />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/carousel" element={<Carousel />} />
          <Route path="/dropdowns" element={<Dropdowns />} />
          <Route path="/images" element={<Images />} />
          <Route path="/links" element={<Links />} />
          <Route path="/list" element={<Lists />} />
          <Route path="/modals" element={<Modals />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/pagination" element={<Pagination />} />
          <Route path="/popovers" element={<Popovers />} />
          <Route path="/progress-bar" element={<Progressbar />} />
          <Route path="/ribbons" element={<Ribbons />} />
          <Route path="/spinners" element={<Spinners />} />
          <Route path="/tabs" element={<Tabs />} />
          <Route path="/tooltips" element={<Tooltips />} />
          <Route path="/videos" element={<Videos />} />

          {/* Charts */}
          <Route path="/line-chart" element={<LineChart />} />
          <Route path="/bar-chart" element={<BarChart />} />
          <Route path="/pie-chart" element={<PieChart />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}