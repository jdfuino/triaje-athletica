"use client";

import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FiSave, FiSend, FiUser, FiActivity, FiMove, FiZap, FiRotateCw, FiFileText } from 'react-icons/fi';

// ─── Natural Language Report Builder ────────────────────────────────────────

const PA_TEXT = {
  'Normal': (s, d) => `Tu presión arterial registró ${s}/${d} mmHg, dentro del rango normal. Esto indica que tu corazón está trabajando con una presión adecuada.`,
  'Elevada': (s, d) => `Tu presión arterial registró ${s}/${d} mmHg, ligeramente por encima del rango ideal. Puede ser transitorio, pero se recomienda mantenerla bajo monitoreo.`,
  'HTA Estadio 1': (s, d) => `Tu presión arterial registró ${s}/${d} mmHg, en el rango de hipertensión estadio 1. Se recomienda seguimiento médico y mejoras en hábitos de vida.`,
  'HTA Estadio 2': (s, d) => `Tu presión arterial registró ${s}/${d} mmHg, en el rango de hipertensión estadio 2. Es importante consultar con un especialista a la brevedad.`,
};
const FC_TEXT = {
  'Normal': (v) => `Tu frecuencia cardíaca en reposo fue de ${v} latidos por minuto, dentro del rango normal, lo que refleja una buena condición cardiovascular.`,
  'Baja': (v) => `Tu frecuencia cardíaca fue de ${v} latidos por minuto, por debajo del rango habitual. En deportistas bien entrenados esto puede ser normal (bradicardia fisiológica), pero es recomendable mencionarlo a tu médico.`,
  'Alta': (v) => `Tu frecuencia cardíaca fue de ${v} latidos por minuto, ligeramente elevada. Puede relacionarse con actividad física reciente, estrés o deshidratación.`,
};
const SPO2_TEXT = {
  'Normal': (v) => `Tu saturación de oxígeno en sangre fue del ${v}%, lo que indica una función respiratoria adecuada.`,
  'Déficit': (v) => `Tu saturación de oxígeno fue del ${v}%, por debajo del valor esperado (≥94%). Se recomienda una evaluación adicional de la función respiratoria.`,
};
const ART_LABELS = {
  hombros: 'hombros', codos: 'codos', munecas: 'muñecas',
  caderas: 'caderas', rodillas: 'rodillas', tobillos: 'tobillos',
};
const MUSCLE_LABELS = {
  deltoides: 'Deltoides', estabilizadoresEsc: 'Estabilizadores escapulares',
  rotadoresHomb: 'Rotadores de hombro', zonaMedia: 'Zona media (core)',
  gluteos: 'Glúteos', isquiotibiales: 'Isquiotibiales',
  cuadriceps: 'Cuádriceps', flexoresCadera: 'Flexores de cadera',
  estabilizadoresTob: 'Estabilizadores de tobillo',
};
const FLEX_LABELS = { psoas: 'Psoas', cuadriceps: 'Cuádriceps', isquiotibiales: 'Isquiotibiales' };

function buildReport(indicators) {
  const r = { vitales: [], rangos: [], fuerza: [], flexibilidad: [] };

  // Signos vitales
  if (indicators.pa.sys && indicators.pa.dia && PA_TEXT[indicators.pa.status])
    r.vitales.push(PA_TEXT[indicators.pa.status](indicators.pa.sys, indicators.pa.dia));
  if (indicators.fc.value && FC_TEXT[indicators.fc.status])
    r.vitales.push(FC_TEXT[indicators.fc.status](indicators.fc.value));
  if (indicators.spo2.value && SPO2_TEXT[indicators.spo2.status])
    r.vitales.push(SPO2_TEXT[indicators.spo2.status](indicators.spo2.value));

  // Rangos articulares
  const rNormal = [], rDef = [], rExc = [];
  Object.entries(indicators.rangos).forEach(([k, v]) => {
    const l = ART_LABELS[k] || k;
    if (v === 'normal') rNormal.push(l);
    else if (v === 'deficit') rDef.push(l);
    else if (v === 'exceso') rExc.push(l);
  });
  if (rNormal.length) r.rangos.push(`Movilidad articular normal en: ${rNormal.join(', ')}.`);
  if (rDef.length) r.rangos.push(`Se detectó limitación en el rango de movimiento en: ${rDef.join(', ')}. Esto puede deberse a tensión muscular, lesiones previas o falta de movilidad específica.`);
  if (rExc.length) r.rangos.push(`Se detectó hipermovilidad en: ${rExc.join(', ')}. La movilidad aumentada puede generar inestabilidad articular si no se trabaja la musculatura de soporte.`);

  // Fuerza muscular
  const fNorm = [], fLeve = [], fMod = [], fSev = [];
  Object.entries(indicators.fuerza).forEach(([k, v]) => {
    if (!v) return;
    const n = parseInt(v);
    const l = MUSCLE_LABELS[k] || k;
    if (n === 5) fNorm.push(l);
    else if (n === 4) fLeve.push(`${l} (${n}/5)`);
    else if (n === 3) fMod.push(`${l} (${n}/5)`);
    else fSev.push(`${l} (${n}/5)`);
  });
  if (fNorm.length) r.fuerza.push(`Fuerza muscular completa (5/5) en: ${fNorm.join(', ')}.`);
  if (fLeve.length) r.fuerza.push(`Leve reducción de fuerza en: ${fLeve.join(', ')}. Se recomienda ejercicio de fortalecimiento específico.`);
  if (fMod.length) r.fuerza.push(`Reducción moderada de fuerza en: ${fMod.join(', ')}. Se sugiere un programa de rehabilitación dirigido.`);
  if (fSev.length) r.fuerza.push(`Reducción significativa de fuerza en: ${fSev.join(', ')}. Requiere atención especializada a la brevedad.`);

  // Flexibilidad
  const flNorm = [], flDef = [];
  Object.entries(indicators.flexibilidad).forEach(([k, v]) => {
    const l = FLEX_LABELS[k] || k;
    if (v === 'normal') flNorm.push(l);
    else if (v === 'deficit') flDef.push(l);
  });
  if (flNorm.length) r.flexibilidad.push(`Flexibilidad adecuada en: ${flNorm.join(', ')}.`);
  if (flDef.length) r.flexibilidad.push(`Flexibilidad reducida en: ${flDef.join(', ')}. Se recomienda incorporar estiramientos regulares específicos para estas zonas.`);

  return r;
}

export default function Home() {
  const [patientData, setPatientData] = useState({ name: '', age: '', email: '', id: '', phone: '' });

  const [indicators, setIndicators] = useState({
    pa: { sys: '', dia: '', status: '' },
    fc: { value: '', status: '' },
    spo2: { value: '', status: '' },
    rangos: {
      hombros: 'normal',
      codos: 'normal',
      munecas: 'normal',
      caderas: 'normal',
      rodillas: 'normal',
      tobillos: 'normal'
    },
    fuerza: {
      deltoides: '', estabilizadoresEsc: '', rotadoresHomb: '', zonaMedia: '',
      gluteos: '', isquiotibiales: '', cuadriceps: '', flexoresCadera: '', estabilizadoresTob: ''
    },
    flexibilidad: {
      psoas: 'normal', cuadriceps: 'normal', isquiotibiales: 'normal'
    },
    observations: ''
  });

  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const pdfRef = useRef(null);
  const resetOnClose = useRef(false);

  useEffect(() => {
    setToday(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      setLogoDataUrl(c.toDataURL('image/png'));
    };
    img.src = '/SilverGame_informe.png';
  }, []);

  // Manipulación del DOM (Vanilla JS) para el modal
  const showModal = (type, title, message) => {
    const modal = document.getElementById('vanilla-modal');
    const modalIcon = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-title');
    const modalMsg = document.getElementById('modal-msg');
    const modalBtn = document.getElementById('modal-btn');

    modalIcon.className = `modal-icon ${type}`;
    if (type === 'loading') {
      modalIcon.innerHTML = '<div class="modal-spinner"></div>';
    } else {
      modalIcon.innerHTML = type === 'success' ? '✓' : '✕';
    }

    modalTitle.innerText = title;
    modalMsg.innerText = message;
    modalBtn.style.display = type === 'loading' ? 'none' : 'block';

    modal.style.display = 'flex';
  };

  const closeModal = () => {
    document.getElementById('vanilla-modal').style.display = 'none';
    if (resetOnClose.current) {
      resetOnClose.current = false;
      window.location.reload();
    }
  };

  const calculatePAStatus = (sys, dia) => {
    if (!sys || !dia) return;
    const s = parseInt(sys); const d = parseInt(dia);
    if (s < 120 && d < 80) return 'Normal';
    if (s >= 120 && s <= 129 && d < 80) return 'Elevada';
    if ((s >= 130 && s <= 139) || (d >= 80 && d <= 89)) return 'HTA Estadio 1';
    if (s >= 140 || d >= 90) return 'HTA Estadio 2';
    return '';
  };

  const handlePAChange = (e, field) => {
    const val = e.target.value;
    const newPA = { ...indicators.pa, [field]: val };
    newPA.status = calculatePAStatus(field === 'sys' ? val : newPA.sys, field === 'dia' ? val : newPA.dia) || '';
    setIndicators({ ...indicators, pa: newPA });
  };

  const handleFCChange = (e) => {
    const val = e.target.value;
    let status = '';
    if (val) {
      if (val < 60) status = 'Baja';
      else if (val > 80) status = 'Alta';
      else status = 'Normal';
    }
    setIndicators({ ...indicators, fc: { value: val, status } });
  };

  const handleSpO2Change = (e) => {
    const val = e.target.value;
    let status = '';
    if (val) {
      if (val >= 94) status = 'Normal';
      else status = 'Déficit';
    }
    setIndicators({ ...indicators, spo2: { value: val, status } });
  };

  const handleRango = (articulation, value) => {
    setIndicators({ ...indicators, rangos: { ...indicators.rangos, [articulation]: value } });
  };

  const handleFuerza = (muscle, value) => {
    setIndicators({ ...indicators, fuerza: { ...indicators.fuerza, [muscle]: value } });
  };

  const handleFlexibilidad = (muscle, value) => {
    setIndicators({ ...indicators, flexibilidad: { ...indicators.flexibilidad, [muscle]: value } });
  };

  const generatePDF = async () => {
    if (!pdfRef.current) return null;
    try {
      setLoading(true);
      const canvas = await html2canvas(pdfRef.current, { scale: 1.5, useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'letter');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const contentHeightMm = pageHeight - margin * 2;
      const pxPerMm = canvas.width / contentWidth;
      const contentHeightPx = contentHeightMm * pxPerMm;

      // Build safe break points: top of each section in canvas pixels.
      // This ensures page cuts always land BETWEEN sections, never mid-text.
      const scale = canvas.width / pdfRef.current.offsetWidth;
      const containerTop = pdfRef.current.getBoundingClientRect().top;
      const sectionEls = pdfRef.current.querySelectorAll(
        '.pdf-header, .pdf-patient-box, .pdf-nl-section, .pdf-signatures'
      );
      const breakPoints = Array.from(sectionEls)
        .map(el => Math.round((el.getBoundingClientRect().top - containerTop) * scale))
        .filter(px => px > 0)
        .sort((a, b) => a - b);

      let yPx = 0;
      let isFirstPage = true;

      while (yPx < canvas.height) {
        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;

        const idealEnd = yPx + contentHeightPx;

        // Find the last safe break point before idealEnd (at least 40% into the page).
        // If none found, fall back to ideal cut (unavoidable for very long single sections).
        let cutAt = idealEnd;
        if (idealEnd < canvas.height) {
          const minCut = yPx + contentHeightPx * 0.4;
          for (const bp of breakPoints) {
            if (bp > minCut && bp <= idealEnd) cutAt = bp;
          }
        }

        const sliceHeightPx = Math.min(cutAt - yPx, canvas.height - yPx);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, yPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

        const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.85);
        const sliceHeightMm = sliceHeightPx / pxPerMm;

        pdf.addImage(sliceImgData, 'JPEG', margin, margin, contentWidth, sliceHeightMm);

        yPx += sliceHeightPx;
      }

      return pdf;
    } catch (err) {
      console.error(err);
      showModal("error", "Error", "Ocurrió un error al generar el PDF.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    const pdf = await generatePDF();
    if (pdf) {
      pdf.save(`Evaluacion_${patientData.name || 'Paciente'}.pdf`);
      showModal("success", "Éxito", "El PDF se ha descargado correctamente.");
    }
  };

  const sendEmail = async () => {
    if (!patientData.email) return showModal("error", "Aviso", "Por favor, ingresa el email del paciente.");
    showModal("loading", "Enviando informe...", "Estamos generando y enviando el PDF al correo del atleta. Esto puede tomar unos segundos.");
    setLoading(true);
    const pdf = await generatePDF();
    if (!pdf) { setLoading(false); closeModal(); return; }

    try {
      const base64PDF = pdf.output('datauristring').split(',')[1];
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: patientData.email,
          patientName: patientData.name,
          pdfBase64: base64PDF
        })
      });
      if (res.ok) {
        resetOnClose.current = true;
        showModal("success", "Email Enviado", "¡El reporte fue enviado exitosamente al paciente!");
      } else {
        showModal("error", "Error de envío", "Hubo un problema al enviar el correo. Por favor intenta de nuevo.");
      }
    } catch (e) {
      console.error(e);
      showModal("error", "Error de red", "Ocurrió un error inesperado al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" >
      {/* Vanilla JS Modal (Oculto por defecto con style.display = 'none') */}
      < div id="vanilla-modal" className="modal-overlay" style={{ display: 'none' }} >
        <div className="modal-content">
          <div id="modal-icon" className="modal-icon"></div>
          <h3 id="modal-title"></h3>
          <p id="modal-msg"></p>
          <button id="modal-btn" className="btn btn-primary" onClick={closeModal} style={{ marginTop: '1.5rem', width: '100%' }}>
            Aceptar
          </button>
        </div>
      </div >

      <header className="main-header">
        <div className="header-logo-area">
          <img src="/SilverGame_Logo.png" alt="Silvers Games" className="header-logo" />
        </div>
        <h1>Evaluación Física</h1>
        <p>Completa el formulario de evaluación para generar el informe del atleta</p>
      </header>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiUser /></span>
          <h2>Datos del Paciente</h2>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Nombre Completo</label>
            <input type="text" placeholder="Nombre del paciente" value={patientData.name} onChange={(e) => setPatientData({ ...patientData, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>ID / Cédula</label>
            <input type="text" placeholder="Documento de identidad" value={patientData.id} onChange={(e) => setPatientData({ ...patientData, id: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Edad</label>
            <input type="number" placeholder="Edad" value={patientData.age} onChange={(e) => setPatientData({ ...patientData, age: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Correo Electrónico</label>
            <input type="email" placeholder="correo@paciente.com" value={patientData.email} onChange={(e) => setPatientData({ ...patientData, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input type="tel" placeholder="Número de teléfono" value={patientData.phone} onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiActivity /></span>
          <h2>Indicadores Cardiovasculares y Oximetría</h2>
        </div>
        <div className="form-row cols-3">
          <div className="form-group">
            <label>Presión Arterial (PAS / PAD)</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="number" placeholder="SISTOLICA" value={indicators.pa.sys} onChange={(e) => handlePAChange(e, 'sys')} />
              <input type="number" placeholder="DIASTOLICA" value={indicators.pa.dia} onChange={(e) => handlePAChange(e, 'dia')} />
            </div>
            {indicators.pa.status && (
              <span className={`vital-status ${indicators.pa.status.includes('Normal') ? 'normal' : 'deficit'}`}>
                {indicators.pa.status}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Frecuencia Cardíaca (L x ')</label>
            <input type="number" placeholder="LPM" value={indicators.fc.value} onChange={handleFCChange} />
            {indicators.fc.status && (
              <span className={`vital-status ${indicators.fc.status === 'Normal' ? 'normal' : 'deficit'}`}>
                {indicators.fc.status}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Oximetría (%SpO2)</label>
            <input type="number" placeholder="%" value={indicators.spo2.value} onChange={handleSpO2Change} />
            {indicators.spo2.status && (
              <span className={`vital-status ${indicators.spo2.status === 'Normal' ? 'normal' : 'deficit'}`}>
                {indicators.spo2.status}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiMove /></span>
          <h2>Rangos Articulares</h2>
        </div>
        <div className="checkbox-group">
          {Object.keys(indicators.rangos).map((art) => (
            <div key={art} className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ textTransform: 'capitalize' }}>{art}</label>
              <div className="status-selector">
                <button className={`status-btn ${indicators.rangos[art] === 'normal' ? 'active normal' : ''}`} onClick={() => handleRango(art, 'normal')}>Normal</button>
                <button className={`status-btn ${indicators.rangos[art] === 'deficit' ? 'active deficit' : ''}`} onClick={() => handleRango(art, 'deficit')}>Déficit</button>
                <button className={`status-btn ${indicators.rangos[art] === 'exceso' ? 'active exceso' : ''}`} onClick={() => handleRango(art, 'exceso')}>Exceso</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiZap /></span>
          <h2>Fuerza Muscular (Escala Daniels)</h2>
        </div>
        <p className="mb-3">Valores esperados: 5/5 Normal. Ingrese el valor evaluado:</p>
        <div className="checkbox-group">
          {Object.keys(indicators.fuerza).map((muscle) => (
            <div key={muscle} className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ textTransform: 'capitalize' }}>{muscle.replace(/([A-Z])/g, ' $1').trim()}</label>
              <input type="number" min="0" max="5" placeholder="0-5" value={indicators.fuerza[muscle]} onChange={(e) => handleFuerza(muscle, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiRotateCw /></span>
          <h2>Flexibilidad</h2>
        </div>
        <div className="checkbox-group">
          {Object.keys(indicators.flexibilidad).map((muscle) => (
            <div key={muscle} className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ textTransform: 'capitalize' }}>{muscle}</label>
              <div className="status-selector">
                <button className={`status-btn ${indicators.flexibilidad[muscle] === 'normal' ? 'active normal' : ''}`} onClick={() => handleFlexibilidad(muscle, 'normal')}>Normal</button>
                <button className={`status-btn ${indicators.flexibilidad[muscle] === 'deficit' ? 'active deficit' : ''}`} onClick={() => handleFlexibilidad(muscle, 'deficit')}>Déficit</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiFileText /></span>
          <h2>Observaciones Adicionales</h2>
        </div>
        <textarea rows="4" placeholder="Escribe alguna conclusión o recomendación..." value={indicators.observations} onChange={(e) => setIndicators({ ...indicators, observations: e.target.value })}></textarea>
      </div>

      <div className="sticky-actions">
        <button className="btn btn-secondary" onClick={downloadPDF} disabled={loading}>
          <FiSave /> {loading ? "Procesando..." : "Descargar PDF"}
        </button>
        <button className="btn btn-primary" onClick={sendEmail} disabled={loading}>
          <FiSend /> {loading ? "Enviando..." : "Enviar al Atleta"}
        </button>
      </div>

      {/* Hidden PDF Canvas rendering area */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={pdfRef} className="pdf-preview">

          {/* Header */}
          <div className="pdf-header">
            <img src={logoDataUrl || '/SilverGame_informe.png'} alt="Silvers Games" style={{ height: '100px', objectFit: 'contain', marginBottom: '14px' }} />
            <h2>Informe de Evaluación Física</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Fecha: {today}
            </p>
          </div>

          {/* Patient info box */}
          <div className="pdf-patient-box" style={{ background: '#f1f5f9', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Datos del Atleta</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 20px', fontSize: '14px' }}>
              {patientData.name && <div><strong>Nombre:</strong> {patientData.name}</div>}
              {patientData.id && <div><strong>Cédula:</strong> {patientData.id}</div>}
              {patientData.age && <div><strong>Edad:</strong> {patientData.age} años</div>}
              {patientData.phone && <div><strong>Teléfono:</strong> {patientData.phone}</div>}
              {patientData.email && <div style={{ gridColumn: '1 / -1' }}><strong>Correo:</strong> {patientData.email}</div>}
            </div>
          </div>

          {/* Natural language sections */}
          {(() => {
            const report = buildReport(indicators);
            const sections = [
              { title: 'Signos Vitales', items: report.vitales },
              { title: 'Rangos Articulares', items: report.rangos },
              { title: 'Fuerza Muscular', items: report.fuerza },
              { title: 'Flexibilidad', items: report.flexibilidad },
            ];
            return sections.map(({ title, items }) =>
              items.length > 0 && (
                <div key={title} className="pdf-nl-section">
                  <div className="pdf-nl-title">{title}</div>
                  {items.map((p, i) => <p key={i} className="pdf-nl-para">{p}</p>)}
                </div>
              )
            );
          })()}

          {/* Doctor observations */}
          {indicators.observations && (
            <div className="pdf-nl-section">
              <div className="pdf-nl-title">Observaciones del Especialista</div>
              <p className="pdf-nl-para">{indicators.observations}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="pdf-signatures">
            <div className="signature-box">
              <div className="signature-img-container">
                <div style={{ fontFamily: 'cursive', fontSize: '24px', color: '#000' }}>Firma Fisiatra</div>
              </div>
              <div className="signature-line">Firma del Médico Evaluador</div>
            </div>
            <div className="signature-box">
              <div className="signature-img-container">
                <div style={{ border: '2px solid red', color: 'red', padding: '10px', transform: 'rotate(-10deg)', fontSize: '18px', fontWeight: 'bold' }}>SELLO OFICIAL</div>
              </div>
              <div className="signature-line">Sello Médico</div>
            </div>
          </div>

        </div>
      </div>
    </div >
  );
}
