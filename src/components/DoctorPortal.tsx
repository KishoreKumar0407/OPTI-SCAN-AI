import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, User } from 'lucide-react';
import { getApiUrl } from '../config';

export const DoctorPortal = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'reports' | 'profiles' | 'appointments'>('reports');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportsRes, profilesRes, appointmentsRes] = await Promise.all([
          fetch(getApiUrl('/api/reports/profile/all')),
          fetch(getApiUrl('/api/profiles/all')),
          fetch(getApiUrl('/api/appointments/all'))
        ]);
        const [reportsData, profilesData, appointmentsData] = await Promise.all([
          reportsRes.json(),
          profilesRes.json(),
          appointmentsRes.json()
        ]);
        setReports(reportsData);
        setProfiles(profilesData);
        setAppointments(appointmentsData);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch admin data", err);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const authorizeProfile = async (profileId: string, isAuthorized: boolean) => {
    await fetch(getApiUrl('/api/profiles/authorize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, isAuthorized })
    });
    // Update local state
    setProfiles(profiles.map(p => p.id === profileId ? { ...p, is_authorized: isAuthorized ? 1 : 0 } : p));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold text-slate-900">Admin Portal</h2>
          <p className="text-slate-500">Manage screenings and authorize family profiles.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setTab('reports')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'reports' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            Reports
          </button>
          <button 
            onClick={() => setTab('profiles')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'profiles' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            Profiles
          </button>
          <button 
            onClick={() => setTab('appointments')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'appointments' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            Appointments
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {tab === 'reports' ? (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Patient</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">ID</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center">Loading...</td></tr>
              ) : reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-4 font-semibold">{r.patient_name}</td>
                  <td className="px-8 py-4 text-sm font-mono text-slate-500">{r.id}</td>
                  <td className="px-8 py-4 text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-8 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-slate-900"><ExternalLink size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'profiles' ? (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Profile Name</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Relationship</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-4 font-semibold">{p.name}</td>
                  <td className="px-8 py-4 text-sm text-slate-500">{p.relationship}</td>
                  <td className="px-8 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${p.is_authorized ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.is_authorized ? 'Authorized' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <button 
                      onClick={() => authorizeProfile(p.id, !p.is_authorized)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold ${p.is_authorized ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}
                    >
                      {p.is_authorized ? 'Revoke' : 'Authorize'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'appointments' ? (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Patient</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Appointment ID</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Date Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center">Loading...</td></tr>
              ) : appointments.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-4 font-semibold">{a.patient_name}</td>
                  <td className="px-8 py-4 text-sm font-mono text-slate-500">{a.id}</td>
                  <td className="px-8 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${a.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm text-slate-500 text-right">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
};
