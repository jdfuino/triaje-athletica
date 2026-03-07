"use client";

import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FiSave, FiSend, FiUser, FiActivity, FiMove, FiZap, FiRotateCw, FiFileText } from 'react-icons/fi';

export default function Home() {
  const [eventData] = useState({
    name: 'Silvers Games',
    date: new Date().toISOString().split('T')[0],
    location: ''
  });
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
  const pdfRef = useRef(null);

  // Manipulación del DOM (Vanilla JS) para el modal
  const showModal = (type, title, message) => {
    const modal = document.getElementById('vanilla-modal');
    const modalIcon = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-title');
    const modalMsg = document.getElementById('modal-msg');

    // Configurar icono y estilo
    modalIcon.className = `modal-icon ${type}`;
    modalIcon.innerHTML = type === 'success' ? '✓' : '✕';

    // Configurar textos
    modalTitle.innerText = title;
    modalMsg.innerText = message;

    // Mostrar modal (ajustando el display CSS)
    modal.style.display = 'flex';
  };

  const closeModal = () => {
    document.getElementById('vanilla-modal').style.display = 'none';
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
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'letter');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12; // mm — top/bottom/side margins
      const contentWidth = pageWidth - margin * 2;
      const contentHeightMm = pageHeight - margin * 2;

      // Canvas pixels per mm (based on content width)
      const pxPerMm = canvas.width / contentWidth;
      const contentHeightPx = contentHeightMm * pxPerMm;

      let yPx = 0;
      let isFirstPage = true;

      while (yPx < canvas.height) {
        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;

        const sliceHeightPx = Math.min(contentHeightPx, canvas.height - yPx);

        // Slice the canvas for this page segment
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, yPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

        const sliceImgData = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = sliceHeightPx / pxPerMm;

        pdf.addImage(sliceImgData, 'PNG', margin, margin, contentWidth, sliceHeightMm);

        yPx += contentHeightPx;
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
    const pdf = await generatePDF();
    if (!pdf) return;

    setLoading(true);
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
          <button className="btn btn-primary" onClick={closeModal} style={{ marginTop: '1.5rem', width: '100%' }}>
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
          <div className="pdf-header">
            <h1>Silvers Games</h1>
            <h2>Triaje de Condición Física</h2>
            {eventData.name && <p><strong>Evento:</strong> {eventData.name} - {eventData.location} ({eventData.date})</p>}
          </div>

          <div className="pdf-section">
            <div className="pdf-section-title">Datos del Paciente</div>
            <div className="pdf-row"><span className="pdf-label">Nombre:</span> <span>{patientData.name || 'N/A'}</span></div>
            <div className="pdf-row"><span className="pdf-label">ID / Cédula:</span> <span>{patientData.id || 'N/A'}</span></div>
            <div className="pdf-row"><span className="pdf-label">Edad:</span> <span>{patientData.age || 'N/A'}</span></div>
            <div className="pdf-row"><span className="pdf-label">Correo:</span> <span>{patientData.email || 'N/A'}</span></div>
            <div className="pdf-row"><span className="pdf-label">Teléfono:</span> <span>{patientData.phone || 'N/A'}</span></div>
          </div>

          <div className="pdf-section">
            <div className="pdf-section-title">Signos Vitales</div>
            <div className="pdf-row"><span className="pdf-label">Presión Arterial:</span> <span>{indicators.pa.sys}/{indicators.pa.dia} mmHg ({indicators.pa.status})</span></div>
            <div className="pdf-row"><span className="pdf-label">Frecuencia Cardíaca:</span> <span>{indicators.fc.value} LPM ({indicators.fc.status})</span></div>
            <div className="pdf-row"><span className="pdf-label">Oximetría SpO2:</span> <span>{indicators.spo2.value}% ({indicators.spo2.status})</span></div>
          </div>

          <div className="pdf-section">
            <div className="pdf-section-title">Rangos Articulares</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Object.keys(indicators.rangos).map(art => (
                <div key={art} className="pdf-row" style={{ border: 'none' }}><span className="pdf-label" style={{ textTransform: 'capitalize' }}>{art}:</span> <span>{indicators.rangos[art]}</span></div>
              ))}
            </div>
          </div>

          <div className="pdf-section">
            <div className="pdf-section-title">Fuerza Muscular (Daniels)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Object.keys(indicators.fuerza).map(muscle => (
                <div key={muscle} className="pdf-row" style={{ border: 'none' }}><span className="pdf-label" style={{ textTransform: 'capitalize' }}>{muscle.replace(/([A-Z])/g, ' $1').trim()}:</span> <span>{indicators.fuerza[muscle] ? `${indicators.fuerza[muscle]}/5` : 'N/A'}</span></div>
              ))}
            </div>
          </div>

          <div className="pdf-section">
            <div className="pdf-section-title">Flexibilidad</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Object.keys(indicators.flexibilidad).map(muscle => (
                <div key={muscle} className="pdf-row" style={{ border: 'none' }}><span className="pdf-label" style={{ textTransform: 'capitalize' }}>{muscle}:</span> <span>{indicators.flexibilidad[muscle]}</span></div>
              ))}
            </div>
          </div>

          {indicators.observations && (
            <div className="pdf-section">
              <div className="pdf-section-title">Observaciones y Conclusiones</div>
              <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{indicators.observations}</p>
            </div>
          )}

          <div className="pdf-signatures">
            <div className="signature-box">
              <div className="signature-img-container">
                {/* Placeholder for real signature image */}
                <div style={{ fontFamily: 'cursive', fontSize: '24px', color: '#000' }}>Firma Fisiatra</div>
              </div>
              <div className="signature-line">Firma del Médico Evaluador</div>
            </div>
            <div className="signature-box">
              <div className="signature-img-container">
                {/* Placeholder for stamp image */}
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
