/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Eye, 
  Activity, 
  Info,
  RefreshCw,
  Download,
  User,
  Stethoscope,
  LayoutDashboard,
  ClipboardList,
  ShieldCheck,
  Volume2,
  Mic,
  Maximize2,
  Droplets,
  Sun,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { analyzeVision, ScreeningData } from './services/geminiService';
import { generatePDFReport } from './services/reportService';
import { getApiUrl } from './config';
import { EyeTracker } from './components/EyeTracker';
import { CardDetectionService } from './services/cardDetectionService';
import { LightingService, LightingAnalysis } from './services/lightingService';
import { VisionDashboard } from './components/Dashboard';
import { SnellenChart, AstigmatismWheel, IshiharaTest } from './components/VisionCharts';
import { RefractorSim } from './components/RefractorSim';
import { DoctorPortal } from './components/DoctorPortal';
import { Chatbot } from './components/Chatbot';

// Voice Assistant Helper
const speak = (text: string) => {
  // Voice assistant disabled as per user request
  console.log("Voice Assistant (Disabled):", text);
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [uploadingReport, setUploadingReport] = useState<string | null>(null);
  const [patientInfo, setPatientInfo] = useState({ name: '', age: '', gender: 'Male', history: '' });
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [secondaryImages, setSecondaryImages] = useState<string[]>([]);
  const [segmentationResults, setSegmentationResults] = useState<any[]>([]);
  const [cardCalibration, setCardCalibration] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [clinicalMode, setClinicalMode] = useState(false);

  // Auto-voice guidance
  useEffect(() => {
    // Automated voice prompts disabled as per user request
  }, [location.pathname]);

  const resetScreeningState = () => {
    setSymptoms([]);
    setCapturedImages([]);
    setSecondaryImages([]);
    setSegmentationResults([]);
    setCardCalibration(null);
    setAnalysisResult(null);
    setTrackingData(null);
    setError(null);
    setUploadingReport(null);
  };

  useEffect(() => {
    if (currentProfile) {
      setPatientInfo({
        name: currentProfile.name,
        age: currentProfile.age.toString(),
        gender: currentProfile.gender || 'Male',
        history: currentProfile.history || ''
      });
    }
  }, [currentProfile]);

  useEffect(() => {
    if (user) {
      fetch(`/api/profiles/${user.id}`)
        .then(res => res.json())
        .then(data => setProfiles(data));
    }
  }, [user]);

  const handleLogin = async (username: string, password: string, isRegistering: boolean = false) => {
    setError(null); // Clear previous errors
    const endpoint = isRegistering ? '/api/register' : '/api/login';
    try {
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        if (isRegistering) {
          setError("Registration successful! Please sign in.");
          return true;
        }
        setUser(data.user);
        // Fetch profiles immediately after login to ensure dashboard is ready
        const profRes = await fetch(getApiUrl(`/api/profiles/${data.user.id}`));
        const profData = await profRes.json();
        setProfiles(profData);
        
        // Auto-select 'Self' profile if it exists
        const self = profData.find((p: any) => p.relationship === 'Self');
        if (self) setCurrentProfile(self);
        
        navigate('/dashboard');
        return true;
      } else {
        setError(data.message || "Authentication failed");
        return false;
      }
    } catch (err) {
      setError("Server error. Please try again later.");
      return false;
    }
  };

  const saveReport = async (result: any) => {
    const id = `OPTI-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    result.id = id; // attach id for appointment booking
    try {
      await fetch(getApiUrl('/api/reports'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          profileId: currentProfile?.id, 
          patientName: currentProfile?.name || patientInfo.name, 
          data: result,
          previousReportData: uploadingReport
        })
      });
      // Reports are auto-fetched when UserDashboard remounts
    } catch (err) {
      console.error("Failed to save report to server");
    }
  };

  const bookAppointment = async (reportId?: string) => {
    try {
      await fetch(getApiUrl('/api/appointments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile?.id,
          patientName: currentProfile?.name || patientInfo.name,
          reportId: reportId || null
        })
      });
      alert("Appointment Booked Successfully! The doctor has been notified.");
    } catch (err) {
      alert("Failed to book appointment.");
    }
  };

  const handleAnalysis = async () => {
    const allImages = [...capturedImages, ...secondaryImages].filter(img => typeof img === 'string' && img.startsWith('data:image'));
    if (allImages.length === 0) {
      setError("No valid eye images captured. Please restart the screening process and ensure your camera is working.");
      navigate('/test/calibration');
      return;
    }

    navigate('/test/processing');
    try {
      console.log("Starting analysis with images:", allImages.length);
      
      const data: ScreeningData = { 
        ...patientInfo, 
        age: parseInt(patientInfo.age) || 0, 
        symptoms, 
        images: allImages,
        previousReport: uploadingReport,
        trackingData,
        segmentationData: segmentationResults,
        cardCalibration
      };
      const result = await analyzeVision(data);
      console.log("Analysis result received:", !!result);
      setAnalysisResult(result);
      await saveReport(result);
      navigate('/test/results');
    } catch (err: any) {
      console.error("Analysis handler error:", err);
      setError(`Analysis failed: ${err.message || "Unknown error"}. Please ensure your camera captured clear images and try again.`);
      navigate('/test/results');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Eye size={18} />
            </div>
            OPTISCANN
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <Link to="/dashboard" className={`hover:text-slate-900 transition-colors flex items-center gap-2 ${location.pathname === '/dashboard' ? 'text-slate-900' : ''}`}>
              <LayoutDashboard size={16} /> Dashboard
            </Link>
            <Link to="/doctor" className={`hover:text-slate-900 transition-colors flex items-center gap-2 ${location.pathname === '/doctor' ? 'text-slate-900' : ''}`}>
              <ShieldCheck size={16} /> Doctor Portal
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setClinicalMode(!clinicalMode)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${clinicalMode ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Clinical Mode: {clinicalMode ? 'ON' : 'OFF'}
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
              <Volume2 size={20} />
            </button>
            <Link to="/dashboard" className="px-5 py-2 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800 transition-all">
              Start Screening
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/dashboard" element={user ? <UserDashboard user={user} profiles={profiles} setProfiles={setProfiles} setCurrentProfile={setCurrentProfile} uploadingReport={uploadingReport} setUploadingReport={setUploadingReport} resetState={resetScreeningState} /> : <Login onLogin={handleLogin} />} />
            <Route path="/doctor" element={<DoctorPortal />} />
            <Route path="/test" element={currentProfile ? <TestIntro /> : <Navigate to="/dashboard" />} />
            <Route path="/test/prep" element={currentProfile ? <TestPrep /> : <Navigate to="/dashboard" />} />
            <Route path="/test/info" element={currentProfile ? <TestInfo patientInfo={patientInfo} setPatientInfo={setPatientInfo} /> : <Navigate to="/dashboard" />} />
            <Route path="/test/card-calibration" element={currentProfile ? <TestCardCalibration onComplete={(data: any) => { setCardCalibration(data); navigate('/test/calibration'); }} /> : <Navigate to="/dashboard" />} />
            <Route path="/test/calibration" element={currentProfile ? <TestCalibration onTrackingUpdate={setTrackingData} setCapturedImages={setCapturedImages} setSegmentationResults={setSegmentationResults} /> : <Navigate to="/dashboard" />} />
            <Route path="/test/charts" element={currentProfile ? <TestCharts /> : <Navigate to="/dashboard" />} />
            <Route path="/test/refractor" element={currentProfile ? <TestRefractor /> : <Navigate to="/dashboard" />} />
            <Route path="/test/eye-capture" element={currentProfile ? <TestEyeCapture onTrackingUpdate={setTrackingData} setCapturedImages={setSecondaryImages} setSegmentationResults={setSegmentationResults} /> : <Navigate to="/dashboard" />} />
            <Route path="/test/symptoms" element={currentProfile ? <TestSymptoms symptoms={symptoms} setSymptoms={setSymptoms} onComplete={handleAnalysis} /> : <Navigate to="/dashboard" />} />
            <Route path="/test/processing" element={currentProfile ? <TestProcessing imagesCount={capturedImages.length + secondaryImages.length} /> : <Navigate to="/dashboard" />} />
            <Route path="/test/results" element={currentProfile ? <TestResults analysisResult={analysisResult} patientInfo={patientInfo} clinicalMode={clinicalMode} onRetry={handleAnalysis} error={error} resetState={resetScreeningState} bookAppointment={bookAppointment} /> : <Navigate to="/dashboard" />} />
          </Routes>
        </AnimatePresence>
      </main>

      {error && (
        <div className="fixed bottom-8 right-8 bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <AlertCircle size={20} />
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      <Chatbot />
    </div>
  );
}

// --- Page Components ---

const Login = ({ onLogin }: { onLogin: (u: string, p: string, r: boolean) => Promise<boolean> }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) return;
    setLoading(true);
    const success = await onLogin(username, password, isRegistering);
    setLoading(false);
    if (success && isRegistering) {
      setIsRegistering(false);
      setPassword('');
    }
  };

  return (
    <div className="max-w-md mx-auto py-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-8"
      >
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-slate-900/20">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            {isRegistering ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-slate-500 text-sm">
            {isRegistering ? 'Join OPTISCANN for advanced vision tracking.' : 'Securely access your clinical vision dashboard.'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">Username</label>
            <input 
              type="text" 
              placeholder="Enter your username" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSubmit()}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" 
            />
          </div>
          
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw size={18} className="animate-spin" />}
            {isRegistering ? 'Register' : 'Sign In'}
          </button>
        </div>

        <div className="text-center">
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setPassword('');
            }}
            className="text-sm font-semibold text-slate-400 hover:text-slate-900 transition-colors"
          >
            {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const UserDashboard = ({ user, profiles, setProfiles, setCurrentProfile, uploadingReport, setUploadingReport, resetState }: any) => {
  const navigate = useNavigate();
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', age: '', gender: 'Male', relationship: 'Wife' });
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetch(getApiUrl('/api/reports/profile/all'))
        .then(res => res.json())
        .then(data => {
          const userProfileIds = profiles.map((p: any) => p.id);
          const userReports = data.filter((r: any) => userProfileIds.includes(r.profile_id));
          setReports(userReports);
        });
    }
  }, [user, profiles]);

  const startScreeningForProfile = async (profile: any) => {
    setCurrentProfile(profile);
    resetState();
    if (!uploadingReport) {
      try {
        const res = await fetch(getApiUrl(`/api/reports/profile/${profile.id}`));
        const data = await res.json();
        if (data && data.length > 0) {
          setUploadingReport(JSON.stringify(data[0].data));
        }
      } catch (err) {
        console.error("Failed to fetch previous report", err);
      }
    }
    navigate('/test');
  };

  const addProfile = async () => {
    if (!newProfile.name || !newProfile.age) return alert("Please fill in all details");
    const id = Math.random().toString(36).substr(2, 9);
    const res = await fetch(getApiUrl('/api/profiles'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newProfile, id, userId: user.id })
    });
    if (res.ok) {
      setProfiles([...profiles, { ...newProfile, id, is_authorized: 1 }]);
      setShowAddProfile(false);
      setNewProfile({ name: '', age: '', gender: 'Male', relationship: 'Wife' });
    }
  };

  const lastScanDate = reports.length > 0 ? new Date(reports[0].created_at).toLocaleDateString() : 'No scans yet';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadingReport(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-12 py-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-widest">
            <CheckCircle2 size={12} /> Account Verified
          </div>
          <h2 className="text-5xl font-bold tracking-tight text-slate-900">Hello, {user.username}</h2>
          <p className="text-slate-500">Welcome to your family vision health center.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAddProfile(true)}
            className="px-6 py-3 bg-white border border-slate-200 rounded-full font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <User size={18} /> Add Family Member
          </button>
        </div>
      </div>

      {/* Main Action Area */}
      <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-slate-900/40">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h3 className="text-4xl font-bold leading-tight">Ready for your <br/><span className="text-emerald-400">Vision Screening?</span></h3>
            <p className="text-slate-400 text-lg max-w-md">
              Start a new AI-guided test for any of your profiles. 
              Results are generated in real-time.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => {
                  const self = profiles.find((p: any) => p.relationship === 'Self');
                  if (self) {
                    startScreeningForProfile(self);
                  } else {
                    // Fallback if profiles haven't loaded yet
                    fetch(getApiUrl(`/api/profiles/${user.id}`))
                      .then(res => res.json())
                      .then(data => {
                        setProfiles(data);
                        const s = data.find((p: any) => p.relationship === 'Self');
                        if (s) {
                          startScreeningForProfile(s);
                        } else {
                          alert("Please add a 'Self' profile first.");
                        }
                      });
                  }
                }}
                className="px-10 py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                Start My Screening
              </button>
              <div className="relative">
                <input 
                  type="file" 
                  id="report-upload" 
                  className="hidden" 
                  accept="application/pdf,image/*"
                  onChange={handleFileUpload}
                />
                <label 
                  htmlFor="report-upload"
                  className="px-8 py-5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all cursor-pointer flex items-center gap-3"
                >
                  <RefreshCw size={20} className={uploadingReport ? 'animate-spin' : ''} />
                  {uploadingReport ? 'Report Ready' : 'Upload Past Report'}
                </label>
              </div>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                <Activity className="text-emerald-400 mb-4" size={32} />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Last Scan</p>
                <p className="text-xl font-bold">{lastScanDate}</p>
              </div>
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                <ShieldCheck className="text-indigo-400 mb-4" size={32} />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                <p className="text-xl font-bold">{reports.length > 0 ? 'Active' : 'New User'}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      {/* Profiles Section */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <User className="text-slate-400" /> Family Profiles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((p: any) => (
            <motion.div 
              key={p.id} 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all space-y-6 group"
            >
              <div className="flex justify-between items-start">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <User size={28} />
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${p.is_authorized ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  Authorized
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{p.name}</h3>
                <p className="text-slate-500">{p.relationship} • {p.age} years</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => startScreeningForProfile(p)}
                  className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all bg-slate-900 text-white hover:bg-slate-800`}
                >
                  Start Screening
                </button>
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-slate-900 hover:bg-slate-100 transition-all">
                  <LayoutDashboard size={20} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {reports.length > 0 && (
        <div className="pt-12">
          <VisionDashboard reports={reports} />
        </div>
      )}

      {showAddProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-white p-10 rounded-[2.5rem] max-w-md w-full space-y-6 shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold">Add Family Member</h3>
              <button onClick={() => setShowAddProfile(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Jane Doe" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" 
                  onChange={e => setNewProfile({...newProfile, name: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Age</label>
                  <input 
                    type="number" 
                    placeholder="Age" 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" 
                    onChange={e => setNewProfile({...newProfile, age: e.target.value})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Relationship</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" 
                    onChange={e => setNewProfile({...newProfile, relationship: e.target.value})}
                  >
                    <option value="Wife">Wife</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowAddProfile(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={addProfile} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">Add Member</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const Home = () => (
  <div className="max-w-4xl mx-auto text-center space-y-12 py-12">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-widest">
        <Activity size={14} /> AI-Powered Vision Screening
      </div>
      <h1 className="text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
        OPTI-SCAN <span className="text-emerald-500">AN AI ASSISTANT</span>
      </h1>
      <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
        Guided step-by-step vision screening using real-time eye tracking and on-device AI.
      </p>
    </motion.div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
      {[
        { icon: <Camera />, title: "Real-Time Tracking", desc: "MediaPipe-powered iris and gaze detection for precise alignment." },
        { icon: <ShieldCheck />, title: "Privacy First", desc: "On-device processing ensures your medical data stays with you." },
        { icon: <FileText />, title: "Clinical Reports", desc: "Generate hospital-style PDF reports with QR code verification." }
      ].map((f, i) => (
        <motion.div 
          key={i} 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: i * 0.1 }}
          className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-900 mb-6">{f.icon}</div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
        </motion.div>
      ))}
    </div>

    <div className="pt-8">
      <Link to="/dashboard" className="px-10 py-5 bg-slate-900 text-white rounded-full font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">
        Start Free Screening
      </Link>
    </div>
  </div>
);

const TestIntro = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto space-y-8 text-center py-12">
      <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
        <Stethoscope size={40} />
      </div>
      <h2 className="text-4xl font-bold">Guided Screening</h2>
      <p className="text-slate-500 text-lg">
        We will guide you through a series of tests including calibration, 
        eye tracking, and interactive charts.
      </p>
      <button onClick={() => navigate('/test/prep')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold text-lg">
        Start Screening
      </button>
    </div>
  );
};

const TestPrep = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold">Preparation</h2>
      <div className="space-y-4">
        {[
          "Well-lit room (natural light is best).",
          "Remove glasses or contacts.",
          "Sit 50cm from the screen.",
          "Have a standard card ready."
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold">{i+1}</div>
            <p className="font-medium text-slate-700">{t}</p>
          </div>
        ))}
      </div>
      <button onClick={() => navigate('/test/card-calibration')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold">Start Screening</button>
    </div>
  );
};

const TestInfo = ({ patientInfo, setPatientInfo }: any) => {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold">Patient Details</h2>
      <div className="grid grid-cols-1 gap-6">
        <input 
          type="text" 
          placeholder="Full Name" 
          value={patientInfo.name} 
          onChange={e => setPatientInfo({...patientInfo, name: e.target.value})}
          className="w-full p-5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900"
        />
        <div className="grid grid-cols-2 gap-4">
          <input 
            type="number" 
            placeholder="Age" 
            value={patientInfo.age} 
            onChange={e => setPatientInfo({...patientInfo, age: e.target.value})}
            className="w-full p-5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900"
          />
          <select 
            value={patientInfo.gender} 
            onChange={e => setPatientInfo({...patientInfo, gender: e.target.value})}
            className="w-full p-5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>
        <textarea 
          placeholder="Medical History" 
          value={patientInfo.history} 
          onChange={e => setPatientInfo({...patientInfo, history: e.target.value})}
          className="w-full p-5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 h-32"
        />
      </div>
      <button onClick={() => navigate('/test/card-calibration')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold">Continue to Calibration</button>
    </div>
  );
};

const TestCardCalibration = ({ onComplete }: { onComplete: (data: any) => void }) => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [calibrationData, setCalibrationData] = useState<any>(null);
  const [lighting, setLighting] = useState<LightingAnalysis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera error", err);
      }
    };
    startCamera();

    // Lighting analysis loop
    const lightingInterval = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = 100; // Small size for analysis
        canvas.height = (video.videoHeight / video.videoWidth) * 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const analysis = LightingService.analyzeFrame(canvas);
          setLighting(analysis);
        }
      }
    }, 1000);

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      clearInterval(lightingInterval);
    };
  }, []);

  const handleCalibrate = async () => {
    setIsCalibrating(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 5;
      });
    }, 100);

    // Simulate detection
    setTimeout(async () => {
      if (canvasRef.current && videoRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          const result = await CardDetectionService.detectCard(canvasRef.current);
          setCalibrationData(result);
        }
      }
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-center">
      <div className="space-y-4">
        <h2 className="text-4xl font-bold tracking-tight">PD Calibration</h2>
        <p className="text-slate-500 max-w-xl mx-auto">
          To accurately measure your Pupillary Distance (PD), we need a reference object. 
          Please hold a <strong>standard credit card or ID card</strong> against your forehead, 
          just above your eyebrows.
        </p>
      </div>

      <div className="relative aspect-video bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Calibration Guide Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-64 h-40 border-2 border-dashed border-white/50 rounded-xl mb-4 flex items-center justify-center">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Place Card Here</p>
          </div>
          <div className="w-1 h-20 bg-emerald-500/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        {isCalibrating && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
            <p className="text-white font-bold tracking-widest uppercase text-xs">
              {progress < 100 ? 'Detecting Card...' : 'Calibration Successful'}
            </p>
          </div>
        )}

        {calibrationData && (
          <div className="absolute top-8 right-8 bg-emerald-500 text-white px-4 py-2 rounded-full text-[10px] font-bold shadow-lg animate-in fade-in zoom-in">
            SCALING: {calibrationData.scalingFactor.toFixed(4)} mm/px
          </div>
        )}

        {lighting && !lighting.isAdequate && (
          <div className="absolute top-8 left-8 right-8 bg-amber-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-xl flex items-center gap-3 animate-bounce">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Sun className="w-4 h-4" />
            </div>
            <span>{lighting.message}</span>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {!calibrationData ? (
          <button 
            onClick={handleCalibrate}
            disabled={isCalibrating}
            className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {isCalibrating ? 'Calibrating...' : 'Start Calibration'}
          </button>
        ) : (
          <button 
            onClick={() => onComplete(calibrationData)}
            className="flex-1 py-5 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
          >
            Continue to Eye Scan
          </button>
        )}
      </div>
    </div>
  );
};

const TestCalibration = ({ onTrackingUpdate, setCapturedImages, setSegmentationResults }: any) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: Whole Face, 1: Focused Eyes
  const [progress, setProgress] = useState(0);
  const [lighting, setLighting] = useState<LightingAnalysis | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      // Only progress if lighting is adequate
      if (lighting && !lighting.isAdequate) return;

      setProgress(p => {
        if (p >= 100) {
          // Capture image at the end of each step
          if ((window as any).captureEyeImage) {
            (window as any).captureEyeImage().then((res: any) => {
              if (res) {
                setCapturedImages((prev: string[]) => [...prev, res.dataUrl]);
                if (res.segmentation) {
                  setSegmentationResults((prev: any[]) => [...prev, res.segmentation]);
                }
              }
            });
          }

          if (step < 1) {
            setStep(s => s + 1);
            return 0;
          }
          clearInterval(timer);
          return 100;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [step, setCapturedImages, lighting]);

  useEffect(() => {
    const lightingInterval = setInterval(() => {
      const video = document.querySelector('video');
      if (video && !canvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, 100, 100);
          const analysis = LightingService.analyzeFrame(canvas);
          setLighting(analysis);
        }
      } else if (video && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = 100;
          canvasRef.current.height = 100;
          ctx.drawImage(video, 0, 0, 100, 100);
          const analysis = LightingService.analyzeFrame(canvasRef.current);
          setLighting(analysis);
        }
      }
    }, 1000);
    return () => clearInterval(lightingInterval);
  }, []);

  const titles = [
    'Phase 1: Whole Face Scan',
    'Phase 1: Focused Eye Scan'
  ];

  const descriptions = [
    'Position your whole face within the frame. Capturing alignment data...',
    'Move closer. Focus the camera on your eyes for high-resolution capture.'
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-center">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">{titles[step]}</h2>
        <p className="text-slate-500">{descriptions[step]}</p>
      </div>

      <div className="relative inline-block w-full max-w-4xl">
        <div className={`absolute inset-0 border-4 rounded-[3rem] z-20 pointer-events-none transition-all duration-500 ${step === 0 ? 'border-emerald-500/30 scale-100' : 'border-emerald-500 scale-[0.6] opacity-80'}`} />
        <div className="aspect-video w-full">
          <EyeTracker onUpdate={onTrackingUpdate} />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {lighting && !lighting.isAdequate && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 flex items-center justify-center p-8 rounded-[3rem]">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm text-center space-y-4 animate-in zoom-in">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Sun className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Lighting Issue</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {lighting.message}
              </p>
              <div className="pt-2">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-500" 
                    style={{ width: `${(lighting.brightness / 255) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-widest">Brightness: {Math.round((lighting.brightness / 255) * 100)}%</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48 h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-md z-30">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-emerald-500"
          />
        </div>
      </div>

      <div className="pt-4">
        <button 
          disabled={progress < 100 || step < 1}
          onClick={() => navigate('/test/charts')}
          className={`w-full py-5 rounded-2xl font-bold transition-all ${progress === 100 && step === 1 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-400'}`}
        >
          {progress < 100 ? 'Scanning...' : 'Phase 1 Complete'}
        </button>
      </div>
    </div>
  );
};

const TestEyeCapture = ({ onTrackingUpdate, setCapturedImages, setSegmentationResults }: any) => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (isCapturing) {
      const timer = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(timer);
            
            // Capture real images
            if ((window as any).captureEyeImage) {
              (window as any).captureEyeImage().then((res1: any) => {
                if (res1) {
                  setCapturedImages([res1.dataUrl]);
                  if (res1.segmentation) {
                    setSegmentationResults((prev: any[]) => [...prev, res1.segmentation]);
                  }
                  
                  // Second capture after a small delay
                  setTimeout(() => {
                    (window as any).captureEyeImage().then((res2: any) => {
                      if (res2) {
                        setCapturedImages((prev: string[]) => [...prev, res2.dataUrl]);
                        if (res2.segmentation) {
                          setSegmentationResults((prev: any[]) => [...prev, res2.segmentation]);
                        }
                      }
                      setIsDone(true);
                    });
                  }, 800);
                } else {
                  setIsDone(true);
                }
              });
            } else {
              setIsDone(true);
            }
            
            return 100;
          }
          return p + 1;
        });
      }, 50);
      return () => clearInterval(timer);
    }
  }, [isCapturing, setCapturedImages, setSegmentationResults]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-center">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Phase 2: Close-up Eye Capture</h2>
        <p className="text-slate-500">
          This second screening captures your eyes alone with maximum focus. 
          Please close your eyes for 2 seconds when prompted, then open wide.
        </p>
      </div>

      <div className="relative inline-block w-full max-w-4xl">
        <div className="absolute inset-0 border-4 border-indigo-500 rounded-[3rem] scale-[0.4] z-20 pointer-events-none" />
        <div className="aspect-video w-full">
          <EyeTracker onUpdate={onTrackingUpdate} />
        </div>
        
        {isCapturing && (
          <div className="absolute inset-0 flex items-center justify-center z-40">
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl"
            >
              {progress < 40 ? 'CLOSE YOUR EYES' : progress < 70 ? 'OPEN WIDE' : 'CAPTURING...'}
            </motion.div>
          </div>
        )}

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48 h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-md z-30">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-indigo-500"
          />
        </div>
      </div>

      <div className="pt-4">
        {!isCapturing ? (
          <button 
            onClick={() => setIsCapturing(true)}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20"
          >
            Start Second Screening
          </button>
        ) : (
          <button 
            disabled={!isDone}
            onClick={() => navigate('/test/symptoms')}
            className={`w-full py-5 rounded-2xl font-bold transition-all ${isDone ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 text-slate-400'}`}
          >
            {isDone ? 'Phase 2 Complete' : 'Capturing Close-up...'}
          </button>
        )}
      </div>
    </div>
  );
};

const TestCharts = () => {
  const navigate = useNavigate();
  const [chartStep, setChartStep] = useState(0);
  const [answers, setAnswers] = useState<any>({});

  const charts = [
    { 
      title: "Snellen Acuity", 
      component: <SnellenChart scale={0.8} />,
      question: "What is the smallest line you can read clearly?",
      options: ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5", "Line 6"]
    },
    { 
      title: "Astigmatism Check", 
      component: <AstigmatismWheel />,
      question: "Do any lines appear darker or thicker than others?",
      options: ["Yes, some lines", "No, all equal", "Not sure"]
    }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8 text-center">
      <h2 className="text-3xl font-bold">{charts[chartStep].title}</h2>
      <div className="flex justify-center py-8">
        {charts[chartStep].component}
      </div>
      
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 text-left">
        <p className="text-lg font-bold">{charts[chartStep].question}</p>
        <div className="grid grid-cols-2 gap-3">
          {charts[chartStep].options.map(opt => (
            <button 
              key={opt}
              onClick={() => setAnswers({...answers, [charts[chartStep].title]: opt})}
              className={`p-4 text-left rounded-2xl border transition-all ${answers[charts[chartStep].title] === opt ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {chartStep > 0 && <button onClick={() => setChartStep(prev => prev - 1)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Back</button>}
        <button 
          onClick={() => chartStep < charts.length - 1 ? setChartStep(prev => prev + 1) : navigate('/test/refractor')} 
          className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-bold"
        >
          {chartStep < charts.length - 1 ? 'Next Chart' : 'Finish Charts'}
        </button>
      </div>
    </div>
  );
};

const TestRefractor = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl mx-auto space-y-8 text-center">
      <h2 className="text-3xl font-bold">Color Blindness Test</h2>
      <p className="text-slate-500">Identify the numbers hidden within the Ishihara plates.</p>
      <IshiharaTest onSelect={(val) => console.log("Color test answer:", val)} />
      <button onClick={() => navigate('/test/eye-capture')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold">Next Phase</button>
    </div>
  );
};

const TestSymptoms = ({ symptoms, setSymptoms, onComplete }: any) => {
  const list = ["Blurred Near", "Blurred Distant", "Double Vision", "Eye Pain", "Itchiness", "Dryness", "Light Sensitivity"];
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold">Subjective Symptoms</h2>
      <div className="grid grid-cols-2 gap-3">
        {list.map(s => (
          <button 
            key={s} 
            onClick={() => setSymptoms((prev: any) => prev.includes(s) ? prev.filter((x: any) => x !== s) : [...prev, s])}
            className={`p-4 text-left rounded-2xl border transition-all ${symptoms.includes(s) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <button onClick={onComplete} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold">Finalize Analysis</button>
    </div>
  );
};

const TestProcessing = ({ imagesCount }: { imagesCount: number }) => (
  <div className="max-w-2xl mx-auto text-center py-20 space-y-8">
    <div className="w-24 h-24 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mx-auto" />
    <div className="space-y-3">
      <h2 className="text-3xl font-bold">Processing Clinical Data</h2>
      <p className="text-slate-500">Analyzing {imagesCount} captured images with AI Vision Engine...</p>
      <div className="flex justify-center gap-2 pt-4">
        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500">Neural Mapping</span>
        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500">Refractive Calculation</span>
        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500">Pathology Screening</span>
      </div>
    </div>
  </div>
);

const TestResults = ({ analysisResult, patientInfo, clinicalMode, onRetry, error, resetState, bookAppointment }: any) => {
  const navigate = useNavigate();

  if (!analysisResult) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-6">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto">
          <AlertCircle size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Analysis Incomplete</h2>
          <p className="text-slate-500">We couldn't generate your vision report. This usually happens if the camera images weren't clear enough for the AI to analyze.</p>
          {error && (
            <div className="mt-4 p-6 bg-rose-50 border border-rose-100 rounded-3xl text-left space-y-4">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm uppercase tracking-wider">
                <AlertCircle size={16} /> Analysis Error
              </div>
              <p className="text-rose-600 text-sm font-medium leading-relaxed">
                {error.includes("429") || error.includes("quota") || error.includes("RESOURCE_EXHAUSTED")
                  ? "You've reached the Gemini API rate limit. This usually happens on the free tier. Please wait about 60 seconds and try again, or switch to a paid API key for higher limits."
                  : error.includes("API key not valid") 
                    ? "The Gemini API key provided is invalid or has expired. To use the high-quality vision analysis, you may need to provide your own API key." 
                    : `Error Details: ${error}`}
              </p>
              
              {(error.includes("API key not valid") || error.includes("429") || error.includes("quota")) && (
                <div className="pt-4 border-t border-rose-100 space-y-4">
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-widest">How to fix this:</p>
                  <ol className="text-xs text-rose-700 space-y-2 list-decimal pl-4">
                    <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold">Google AI Studio</a> and create a free API key.</li>
                    <li>In this application's environment settings, set the <b>GEMINI_API_KEY</b> variable to your new key.</li>
                    <li>If you are using the AI Studio preview, click the <b>"Select API Key"</b> button in the platform header to use a paid project key.</li>
                  </ol>
                  <button 
                    onClick={async () => {
                      if ((window as any).aistudio?.openSelectKey) {
                        await (window as any).aistudio.openSelectKey();
                        onRetry();
                      } else {
                        alert("Please use the platform's API key selection dialog or update your .env file.");
                      }
                    }}
                    className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-900/20 hover:bg-rose-700 transition-colors"
                  >
                    Select Platform API Key
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-4 justify-center pt-4">
          <button 
            onClick={() => { resetState(); navigate('/test/calibration'); }}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg"
          >
            Restart Screening
          </button>
          <button 
            onClick={onRetry}
            className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-bold"
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Screening Report</h2>
          <p className="text-slate-500 mt-1">Generated by OPTISCANN AI Vision Engine</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => generatePDFReport(analysisResult, patientInfo)} className="px-6 py-3 bg-slate-900 text-white rounded-full font-bold flex items-center gap-2 shadow-lg shadow-slate-900/20">
            <Download size={18} /> Download PDF
          </button>
        </div>
      </div>

      {/* AI Explanation Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-emerald-500 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden"
      >
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-emerald-100 text-xs font-bold uppercase tracking-widest">
            <Activity size={14} /> AI Summary
          </div>
          <p className="text-2xl font-medium leading-relaxed max-w-3xl">
            "{analysisResult.explanation}"
          </p>
          {analysisResult.comparison && (
            <div className="pt-4 border-t border-white/20">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-2">Comparison with Previous Report</p>
              <p className="text-sm leading-relaxed opacity-90">{analysisResult.comparison}</p>
            </div>
          )}
        </div>
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Risk Indicators Summary */}
          {analysisResult.eyeHealthIndicators && (
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Risk Indicators</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="text-emerald-500">✔</span> Dry eye: <span className="font-bold ml-1">{analysisResult.eyeHealthIndicators.dryEye?.level || 'Low'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="text-emerald-500">✔</span> Vision strain: <span className="font-bold ml-1">{analysisResult.eyeHealthIndicators.eyeFatigue?.level || 'Low'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="text-emerald-500">✔</span> {analysisResult.eyeHealthIndicators.blinkRateStatus || 'Normal blink rate'}
                </div>
              </div>
            </div>
          )}

          {/* Vision Power Grid */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-900">
                <Maximize2 size={16} />
              </div>
              Refractive Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6 relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-emerald-500 rounded-full" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Right Eye (OD)</p>
                  <div className="text-6xl font-bold tracking-tighter">{analysisResult.results.rightEye.sph} <span className="text-2xl text-slate-300">D</span></div>
                </div>
                <div className="flex gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">CYL</p>
                    <p className="text-xl font-mono font-bold">{analysisResult.results.rightEye.cyl}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">AXIS</p>
                    <p className="text-xl font-mono font-bold">{analysisResult.results.rightEye.axis}°</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6 relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500 rounded-full" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Left Eye (OS)</p>
                  <div className="text-6xl font-bold tracking-tighter">{analysisResult.results.leftEye.sph} <span className="text-2xl text-slate-300">D</span></div>
                </div>
                <div className="flex gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">CYL</p>
                    <p className="text-xl font-mono font-bold">{analysisResult.results.leftEye.cyl}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">AXIS</p>
                    <p className="text-xl font-mono font-bold">{analysisResult.results.leftEye.axis}°</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Eye Health Classification Indicators */}
          {analysisResult.eyeHealthIndicators && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                  <Activity size={16} />
                </div>
                Eye Health Classification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: "Red Eye", data: analysisResult.eyeHealthIndicators.redEye, icon: <div className="w-2 h-2 rounded-full bg-rose-500" /> },
                  { label: "Cataract Glare", data: analysisResult.eyeHealthIndicators.cataractGlare, icon: <div className="w-2 h-2 rounded-full bg-amber-500" /> },
                  { label: "Dry Eye", data: analysisResult.eyeHealthIndicators.dryEye, icon: <div className="w-2 h-2 rounded-full bg-blue-500" /> },
                  { label: "Eye Fatigue", data: analysisResult.eyeHealthIndicators.eyeFatigue, icon: <div className="w-2 h-2 rounded-full bg-indigo-500" /> },
                ].map((item) => (
                  <div key={item.label} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span className="text-sm font-bold text-slate-700">{item.label}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        item.data.level === 'High' ? 'bg-rose-100 text-rose-700' : 
                        item.data.level === 'Medium' ? 'bg-amber-100 text-amber-700' : 
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.data.level} Risk
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.data.probability}%` }}
                        className={`h-full ${
                          item.data.level === 'High' ? 'bg-rose-500' : 
                          item.data.level === 'Medium' ? 'bg-amber-500' : 
                          'bg-emerald-500'
                        }`}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Probability: {item.data.probability}%</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 size={18} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-900">Blink Rate Status</span>
                </div>
                <span className="text-sm font-bold text-emerald-700">{analysisResult.eyeHealthIndicators.blinkRateStatus || 'Normal'}</span>
              </div>
            </div>
          )}

          {/* Advanced Conditions (Clinical Mode Only) */}
          {clinicalMode && analysisResult.advancedConditions && (
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <ShieldCheck className="text-emerald-500" /> Advanced Risk Scoring
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisResult.advancedConditions.map((c: any) => (
                  <div key={c.name} className="p-5 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold">{c.name}</span>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${c.riskScore > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                        {c.riskScore}% RISK
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${c.riskScore > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${c.riskScore}%` }} />
                    </div>
                    <p className="text-xs text-white/40 mt-3 leading-relaxed">{c.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lens Suggestions */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <ClipboardList className="text-indigo-500" /> Smart Lens Recommendations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Recommended Lens</p>
                <p className="text-lg font-bold text-indigo-900">{analysisResult.recommendations.lensSuggestions}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Protective Coatings</p>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.recommendations.coatings?.map((c: string) => (
                    <span key={c} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Diet Chart */}
          {analysisResult.dietChart && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <Droplets className="text-emerald-500" /> Recommended Diet Plan
              </h3>
              <div className="space-y-4">
                {analysisResult.dietChart.map((item: any, i: number) => (
                  <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-500 shrink-0 border border-slate-100">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{item.meal}</p>
                      <p className="font-bold text-slate-900">{item.suggestion}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.benefit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Lifestyle Plan */}
          {analysisResult.lifestylePlan && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <Activity className="text-indigo-500" /> Lifestyle & Hygiene
              </h3>
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Daily Hygiene</p>
                  <p className="text-slate-700 leading-relaxed">{analysisResult.lifestylePlan.hygiene}</p>
                </div>
                {analysisResult.lifestylePlan.exercises && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Recommended Exercises</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysisResult.lifestylePlan.exercises.map((ex: string, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 text-sm text-indigo-900">
                          <CheckCircle2 size={16} className="text-indigo-500" /> {ex}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-900 mx-auto mb-6">
              <User size={32} />
            </div>
            <h3 className="text-2xl font-bold">{patientInfo.name}</h3>
            <p className="text-slate-400 mb-8">{patientInfo.age} years • {patientInfo.gender}</p>
            
            <div className="bg-slate-50 p-6 rounded-3xl inline-block mb-6">
              <QRCodeSVG value={`OPTI-${patientInfo.name}-${Date.now()}`} size={160} />
            </div>
            
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-left">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase mb-1">
                <AlertCircle size={14} /> Follow-up Urgency
              </div>
              <p className="text-sm text-amber-900 font-bold">{analysisResult.recommendations.urgency || 'Routine'}</p>
            </div>
          </div>

          <div className="bg-emerald-500 p-8 rounded-[2rem] text-white space-y-4">
            <h3 className="text-lg font-bold">Next Steps</h3>
            <p className="text-sm text-emerald-100 leading-relaxed">
              {analysisResult.recommendations.followUp}
            </p>
            <button 
              onClick={() => bookAppointment(analysisResult.id)}
              className="w-full py-4 bg-white text-emerald-600 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-900/20 active:scale-95 transition-transform"
            >
              Book Appointment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
