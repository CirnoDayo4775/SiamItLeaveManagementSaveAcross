import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// import SuperAdminDashboard from './pages/SuperAdmin/SuperAdminDashboard';
// import SuperAdminList from './pages/SuperAdmin/SuperAdminList';
// import PositionManager from './pages/SuperAdmin/PositionManager';
// import DepartmentManager from './pages/SuperAdmin/DepartmentManager';
// import LeaveTypeManager from './pages/SuperAdmin/LeaveTypeManager';

createRoot(document.getElementById("root")!).render(<App />);
