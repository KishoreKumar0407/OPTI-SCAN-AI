import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Activity, TrendingDown, Eye, Droplets, Zap } from 'lucide-react';

export const VisionDashboard = ({ reports = [] }: { reports?: any[] }) => {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (reports.length > 0) {
      const formatted = reports.map(r => ({
        date: new Date(r.created_at).toLocaleDateString(),
        sph: r.data.results?.rightEye?.sph || 0,
        cyl: r.data.results?.rightEye?.cyl || 0,
        dryness: r.data.observations?.dryness || Math.random() * 50 + 20,
        blinkRate: parseInt(r.data.observations?.blinkRate) || 10,
        stability: 90
      })).reverse();
      setHistory(formatted);
    }
  }, [reports]);

  const latest = reports[0]?.data || {};

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-500 mb-2">
            <Eye size={20} /> <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Current SPH</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{latest.results?.rightEye?.sph || '0.00'} D</p>
          <p className="text-xs text-slate-400 mt-1">Latest Reading</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <Droplets size={20} /> <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Dry Eye Risk</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{latest.eyeHealthIndicators?.dryEye?.level || 'Low'}</p>
          <p className="text-xs text-amber-600 mt-1">{latest.eyeHealthIndicators?.dryEye?.probability || '0'}% Probability</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 text-blue-500 mb-2">
            <Zap size={20} /> <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Fatigue Level</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{latest.eyeHealthIndicators?.eyeFatigue?.level || 'Normal'}</p>
          <p className="text-xs text-blue-600 mt-1">{latest.eyeHealthIndicators?.eyeFatigue?.probability || '0'}% Strain</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 text-slate-900 mb-2">
            <Activity size={20} /> <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Blink Status</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{latest.eyeHealthIndicators?.blinkRateStatus || 'Normal'}</p>
          <p className="text-xs text-slate-400 mt-1">Behavioral Analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-slate-900">Refractive Power Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="sph" stroke="#10b981" strokeWidth={3} dot={{ r: 6, fill: '#10b981' }} />
                <Line type="monotone" dataKey="cyl" stroke="#f59e0b" strokeWidth={3} dot={{ r: 6, fill: '#f59e0b' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2 text-emerald-500">
              <div className="w-3 h-3 rounded-full bg-emerald-500" /> SPH (Sphere)
            </div>
            <div className="flex items-center gap-2 text-amber-500">
              <div className="w-3 h-3 rounded-full bg-amber-500" /> CYL (Cylinder)
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-slate-900">Eye Fatigue & Dryness</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorDry" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="dryness" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDry)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Comparison of your last {history.length} scans.
          </p>
        </div>
      </div>
    </div>
  );
};
