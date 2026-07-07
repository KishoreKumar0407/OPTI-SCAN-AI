import React from 'react';

export const SnellenChart = ({ scale = 1 }: { scale?: number }) => {
  const lines = [
    { size: 70, letters: "E" },
    { size: 50, letters: "F P" },
    { size: 35, letters: "T O Z" },
    { size: 25, letters: "L P E D" },
    { size: 20, letters: "P E C F D" },
    { size: 15, letters: "E D F C Z P" },
    { size: 12, letters: "F E L O P Z D" },
    { size: 10, letters: "D E F P O T E C" },
  ];

  return (
    <div className="flex flex-col items-center space-y-4 bg-white p-8 rounded-3xl shadow-inner border border-slate-100">
      {lines.map((line, i) => (
        <div 
          key={i} 
          className="font-mono font-bold tracking-[0.5em] text-slate-900"
          style={{ fontSize: `${line.size * scale}px` }}
        >
          {line.letters}
        </div>
      ))}
    </div>
  );
};

export const AstigmatismWheel = () => {
  return (
    <div className="relative w-64 h-64 border-4 border-slate-900 rounded-full flex items-center justify-center">
      {[...Array(12)].map((_, i) => (
        <div 
          key={i}
          className="absolute w-1 h-full bg-slate-900"
          style={{ transform: `rotate(${i * 15}deg)` }}
        />
      ))}
      <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center">
        <div className="w-2 h-2 bg-slate-900 rounded-full" />
      </div>
    </div>
  );
};

export const IshiharaTest = ({ onSelect }: { onSelect?: (val: string) => void }) => {
  const plates = [
    { num: "12", colors: ["#10b981", "#f59e0b"] },
    { num: "8", colors: ["#ef4444", "#10b981"] },
    { num: "6", colors: ["#3b82f6", "#ef4444"] }
  ];
  const [plateIdx, setPlateIdx] = React.useState(0);

  return (
    <div className="space-y-6 flex flex-col items-center">
      <div className="w-64 h-64 rounded-full relative overflow-hidden bg-slate-100 flex items-center justify-center border-8 border-white shadow-xl">
        <div className="absolute inset-0 grid grid-cols-12 gap-1 p-2">
          {[...Array(144)].map((_, i) => (
            <div 
              key={i} 
              className="w-full h-full rounded-full"
              style={{ 
                backgroundColor: Math.random() > 0.7 ? plates[plateIdx].colors[0] : plates[plateIdx].colors[1],
                opacity: Math.random() * 0.6 + 0.4,
                transform: `scale(${Math.random() * 0.5 + 0.5})`
              }}
            />
          ))}
        </div>
        <span className="relative z-10 text-8xl font-bold text-black/20 select-none">{plates[plateIdx].num}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["12", "8", "6", "5", "3", "None"].map(n => (
          <button 
            key={n} 
            onClick={() => {
              if (onSelect) onSelect(n);
              if (plateIdx < plates.length - 1) setPlateIdx(p => p + 1);
            }}
            className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
};
