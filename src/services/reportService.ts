import { jsPDF } from "jspdf";

export const generatePDFReport = (data: any, patientInfo: any) => {
  if (!data) {
    alert("No analysis data available to generate report.");
    return;
  }

  const doc = new jsPDF();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  doc.text("OPTISCANN", margin, y);
  y += 10;
  doc.setFontSize(14);
  doc.text("Preliminary Vision Screening Report", margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, y);
  doc.text(`Report ID: OPTI-${Math.random().toString(36).substring(2, 9).toUpperCase()}`, 140, y);
  y += 10;
  doc.line(margin, y, 190, y);
  y += 15;

  // Patient Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Information", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${patientInfo?.name || 'N/A'}`, margin, y);
  doc.text(`Age: ${patientInfo?.age || 'N/A'}`, 80, y);
  doc.text(`Gender: ${patientInfo?.gender || 'N/A'}`, 140, y);
  y += 15;

  // Vision Power Results
  doc.setFont("helvetica", "bold");
  doc.text("Vision Power Results", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  
  const r = data.results?.rightEye || { sph: 'N/A', cyl: 'N/A', axis: 'N/A', pd: 'N/A' };
  const l = data.results?.leftEye || { sph: 'N/A', cyl: 'N/A', axis: 'N/A', pd: 'N/A' };

  doc.text(`Right Eye (R): SPH ${r.sph} D / CYL ${r.cyl} D / AXIS ${r.axis}° / PD ${r.pd} mm`, margin, y);
  y += 7;
  doc.text(`Left Eye (L): SPH ${l.sph} D / CYL ${l.cyl} D / AXIS ${l.axis}° / PD ${l.pd} mm`, margin, y);
  y += 15;

  // Observations
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Observations", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`Pupil Behavior: ${data.observations?.pupilReactivity || 'N/A'}`, margin, y);
  y += 7;
  doc.text(`Alignment: ${data.observations?.alignment || 'N/A'}`, margin, y);
  y += 7;
  doc.text(`Blink Rate: ${data.observations?.blinkRate || 'N/A'}`, margin, y);
  y += 15;

  // Eye Health Indicators
  if (data.eyeHealthIndicators) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("Eye Health Classification", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const indicators = [
      { label: "Red Eye", val: data.eyeHealthIndicators.redEye },
      { label: "Cataract Glare", val: data.eyeHealthIndicators.cataractGlare },
      { label: "Dry Eye", val: data.eyeHealthIndicators.dryEye },
      { label: "Eye Fatigue", val: data.eyeHealthIndicators.eyeFatigue }
    ];
    indicators.forEach(ind => {
      if (ind.val) {
        doc.text(`${ind.label}: ${ind.val.level} (${ind.val.probability}%)`, margin, y);
        y += 7;
      }
    });
    doc.text(`Blink Rate Status: ${data.eyeHealthIndicators.blinkRateStatus || 'Normal'}`, margin, y);
    y += 15;
  }

  // Defects
  if (data.defects) {
    let defectsArr = data.defects;
    if (typeof defectsArr === 'string') defectsArr = [{name: 'Note', probability: 0, explanation: defectsArr}];
    if (Array.isArray(defectsArr)) {
      doc.setFont("helvetica", "bold");
      doc.text("Detected Defects & Probabilities", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      defectsArr.forEach((defect: any) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${defect.name || 'Unknown'}: ${defect.probability || 0}% - ${defect.explanation || ''}`, margin, y, { maxWidth: 170 });
        y += 12;
      });
      y += 5;
    }
  }

  // Advanced Conditions
  if (data.advancedConditions && Array.isArray(data.advancedConditions) && data.advancedConditions.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Advanced Condition Risk Analysis", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    data.advancedConditions.forEach((c: any) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${c.name || 'Unknown'}: ${c.riskScore || 0}% Risk - ${c.notes || ''}`, margin, y, { maxWidth: 170 });
      y += 10;
    });
    y += 5;
  }

  // Comparison
  if (data.comparison) {
    doc.setFont("helvetica", "bold");
    doc.text("Comparison with Previous Screening", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(data.comparison, margin, y, { maxWidth: 170 });
    y += 15;
  }

  // Diet Chart
  if (data.dietChart) {
    let dietArr = data.dietChart;
    if (typeof dietArr === 'string') dietArr = [{meal: 'General', suggestion: dietArr, benefit: ''}];
    if (Array.isArray(dietArr) && dietArr.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Recommended Diet Plan", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      dietArr.forEach((item: any) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${item.meal || ''}: ${item.suggestion || ''} (${item.benefit || ''})`, margin, y, { maxWidth: 170 });
        y += 10;
      });
      y += 10;
    }
  }

  // Recommendations
  if (data.recommendations) {
    doc.setFont("helvetica", "bold");
    doc.text("Recommendations & Lens Suggestions", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Lens Type: ${data.recommendations.lensSuggestions || 'N/A'}`, margin, y);
    y += 7;
    
    let coatingsText = 'N/A';
    if (Array.isArray(data.recommendations.coatings)) {
      coatingsText = data.recommendations.coatings.join(', ');
    } else if (typeof data.recommendations.coatings === 'string') {
      coatingsText = data.recommendations.coatings;
    }
    doc.text(`Coatings: ${coatingsText}`, margin, y);
    y += 7;
    doc.text(`Follow-up: ${data.recommendations.followUp || 'N/A'}`, margin, y, { maxWidth: 170 });
    y += 7;
    doc.text(`Urgency: ${data.recommendations.urgency || 'N/A'}`, margin, y);
    y += 20;
  }

  // Lifestyle Plan
  if (data.lifestylePlan) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("Lifestyle & Hygiene Plan", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Hygiene: ${data.lifestylePlan.hygiene || 'N/A'}`, margin, y, { maxWidth: 170 });
    y += 10;
    if (data.lifestylePlan.exercises) {
      let exText = 'N/A';
      if (Array.isArray(data.lifestylePlan.exercises) && data.lifestylePlan.exercises.length > 0) {
        exText = data.lifestylePlan.exercises.join(', ');
      } else if (typeof data.lifestylePlan.exercises === 'string') {
        exText = data.lifestylePlan.exercises;
      }
      doc.text(`Exercises: ${exText}`, margin, y, { maxWidth: 170 });
      y += 10;
    }
    y += 10;
  }

  // Footer Disclaimer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const disclaimer = "This is a preliminary AI screening, not a medical diagnosis. Consult a certified ophthalmologist for final confirmation.";
  doc.text(disclaimer, margin, 285);

  doc.save(`OPTISCANN_Report_${patientInfo?.name || 'Patient'}.pdf`);
};
