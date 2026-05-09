"use client";

import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FiSave, FiSend, FiUser, FiActivity, FiMove, FiZap, FiRotateCw, FiFileText, FiLogOut, FiHome, FiAlignCenter, FiPlay, FiPause, FiEdit2 } from 'react-icons/fi';
import { BiLaugh, BiHappy, BiFace, BiSad, BiAngry, BiDizzy } from 'react-icons/bi';
import { createBrowserClient } from '@supabase/ssr';

// ─── Module Note Labels ───────────────────────────────────────────────────────
const MODULO_LABELS = {
  vitales:     'Indicadores Cardiovasculares y Oximetría',
  rangos:      'Rangos Articulares',
  eva:         'Escala de Dolor (EVA)',
  fuerza:      'Fuerza Muscular',
  adams:       'Prueba de Adams',
  flexibilidad:'Flexibilidad',
  sts:         'Sit-to-Stand Test',
  dinamometro: 'Fuerza de Presión con Dinamómetro',
};

// ─── EVA Pain Scale ──────────────────────────────────────────────────────────
const EVA_CATS = [
  { range: [0, 0],  label: 'Sin Dolor',       color: '#10b981', bg: '#d1fae5', Icon: BiLaugh,  selectVal: 0 },
  { range: [1, 2],  label: 'Poco Dolor',       color: '#65a30d', bg: '#ecfccb', Icon: BiHappy,  selectVal: 1 },
  { range: [3, 4],  label: 'Dolor Moderado',   color: '#f59e0b', bg: '#fef3c7', Icon: BiFace,   selectVal: 3 },
  { range: [5, 6],  label: 'Dolor Fuerte',     color: '#f97316', bg: '#ffedd5', Icon: BiSad,    selectVal: 5 },
  { range: [7, 8],  label: 'Dolor Muy Fuerte', color: '#ef4444', bg: '#fee2e2', Icon: BiAngry,  selectVal: 7 },
  { range: [9, 10], label: 'Dolor Extremo',    color: '#991b1b', bg: '#fee2e2', Icon: BiDizzy,  selectVal: 9 },
];
const EVA_NUM_COLORS = ['#10b981','#65a30d','#84cc16','#eab308','#f59e0b','#f97316','#ea580c','#ef4444','#dc2626','#b91c1c','#991b1b'];

function getEvaCat(value) {
  if (value === null || value === undefined) return null;
  return EVA_CATS.find(c => value >= c.range[0] && value <= c.range[1]) || null;
}

// ─── STS Normative Values (Otto-Yáñez et al. 2025, Chilean population) ────────
// p = [P2.5, P25, P50, P75, P97.5]. P25 is the Normal threshold.
const STS_NORMS = {
  femenino: [
    { min: 18, max: 29, label: '18–29', p: [28, 33, 38, 45, 61] },
    { min: 30, max: 39, label: '30–39', p: [23, 33, 38, 44, 60] },
    { min: 40, max: 49, label: '40–49', p: [22, 28, 33, 38, 47] },
    { min: 50, max: 59, label: '50–59', p: [20, 26, 32, 37, 53] },
    { min: 60, max: 69, label: '60–69', p: [17, 23, 28, 33, 49] },
    { min: 70, max: 80, label: '70–80', p: [17, 21, 24, 30, 47] },
  ],
  masculino: [
    { min: 18, max: 29, label: '18–29', p: [27, 32, 38, 47, 61] },
    { min: 30, max: 39, label: '30–39', p: [26, 31, 39, 47, 55] },
    { min: 40, max: 49, label: '40–49', p: [26, 30, 30, 37, 58] },
    { min: 50, max: 59, label: '50–59', p: [20, 28, 32, 39, 58] },
    { min: 60, max: 69, label: '60–69', p: [15, 23, 25, 30, 37] },
    { min: 70, max: 80, label: '70–80', p: [15, 20, 23, 26, 31] },
  ],
};

const STS_BANDS = [
  { key: '<P2.5', label: '< P2.5', color: '#dc2626', bg: '#fee2e2', colIdx: -1, text: 'Rendimiento muy bajo — se recomienda evaluación médica especializada' },
  { key: 'P2.5',  label: 'P2.5',   color: '#ef4444', bg: '#fee2e2', colIdx:  0, text: 'Bajo rendimiento — se recomienda programa de ejercicios supervisado' },
  { key: 'P25',   label: 'P25',    color: '#f59e0b', bg: '#fef3c7', colIdx:  1, text: 'Rendimiento normal bajo — en el límite inferior del rango esperado' },
  { key: 'P50',   label: 'P50',    color: '#10b981', bg: '#d1fae5', colIdx:  2, text: 'Rendimiento normal — dentro del rango esperado para su grupo etario' },
  { key: 'P75',   label: 'P75',    color: '#06b6d4', bg: '#cffafe', colIdx:  3, text: 'Buen rendimiento — por encima del promedio para su grupo etario' },
  { key: 'P97.5', label: 'P97.5',  color: '#05254F', bg: '#dbeafe', colIdx:  4, text: 'Rendimiento excelente — en el percentil superior para su grupo etario' },
];

function getStsNorm(age, genero) {
  const key = genero?.toLowerCase() === 'femenino' ? 'femenino' : 'masculino';
  const age_n = parseInt(age);
  if (!age_n) return null;
  return STS_NORMS[key].find(n => age_n >= n.min && age_n <= n.max) || null;
}

function calcStsStatus(reps, age, genero) {
  const norm = getStsNorm(age, genero);
  if (!norm || reps === '' || reps === null) return '';
  return parseInt(reps) >= norm.p[1] ? 'normal' : 'deficit';
}

function getStsPercentile(reps, age, genero) {
  const norm = getStsNorm(age, genero);
  if (!norm || reps === '' || reps === null || reps === undefined) return null;
  const r = parseInt(reps);
  if (isNaN(r) || r < 0) return null;
  const [p2_5, p25, p50, p75, p97_5] = norm.p;
  let band;
  if      (r < p2_5)  band = STS_BANDS[0];
  else if (r < p25)   band = STS_BANDS[1];
  else if (r < p50)   band = STS_BANDS[2];
  else if (r < p75)   band = STS_BANDS[3];
  else if (r < p97_5) band = STS_BANDS[4];
  else                band = STS_BANDS[5];
  return { norm, band };
}

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
const STS_TEXT = {
  normal:  (r) => `En la prueba funcional Sit-to-Stand (60 segundos), completaste ${r} repeticiones, resultado dentro de los parámetros normales. Esto refleja una buena capacidad funcional de tus miembros inferiores.`,
  deficit: (r) => `En la prueba funcional Sit-to-Stand (60 segundos), completaste ${r} repeticiones, resultado que indica una reducción en la capacidad funcional de miembros inferiores. Se recomienda un programa de fortalecimiento progresivo.`,
};

function buildReport(indicators, notas = {}) {
  const r = { vitales: [], rangos: [], fuerza: [], adams: [], flexibilidad: [], eva: [], sts: [], dinamometro: [] };

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

  // Prueba de Adams
  const a = indicators.adams;
  if (a.columna === 'normal')
    r.adams.push('La prueba de Adams no mostró desviaciones en la columna vertebral, lo que indica una postura vertebral dentro de los parámetros normales.');
  if (a.columna === 'escoliosis')
    r.adams.push('La prueba de Adams evidenció una desviación lateral de la columna vertebral compatible con escoliosis. Se recomienda evaluación médica especializada.');
  if (a.gibaToracica === 'derecha')
    r.adams.push('Se observó prominencia costal en el hemitórax derecho durante la flexión anterior, hallazgo compatible con rotación vertebral torácica derecha.');
  if (a.gibaToracica === 'izquierda')
    r.adams.push('Se observó prominencia costal en el hemitórax izquierdo durante la flexión anterior, hallazgo compatible con rotación vertebral torácica izquierda.');
  if (a.prominenciaLumbar === 'derecha')
    r.adams.push('Se detectó prominencia de la musculatura paravertebral lumbar derecha, sugestiva de componente rotacional en la región lumbar.');
  if (a.prominenciaLumbar === 'izquierda')
    r.adams.push('Se detectó prominencia de la musculatura paravertebral lumbar izquierda, sugestiva de componente rotacional en la región lumbar.');

  // Flexibilidad
  const flNorm = [], flDef = [];
  Object.entries(indicators.flexibilidad).forEach(([k, v]) => {
    const l = FLEX_LABELS[k] || k;
    if (v === 'normal') flNorm.push(l);
    else if (v === 'deficit') flDef.push(l);
  });
  if (flNorm.length) r.flexibilidad.push(`Flexibilidad adecuada en: ${flNorm.join(', ')}.`);
  if (flDef.length) r.flexibilidad.push(`Flexibilidad reducida en: ${flDef.join(', ')}. Se recomienda incorporar estiramientos regulares específicos para estas zonas.`);

  // Escala de Dolor EVA
  if (indicators.eva !== null && indicators.eva !== undefined) {
    const v = indicators.eva;
    const cat = getEvaCat(v);
    const label = cat?.label || '';
    if (v === 0)
      r.eva.push('El atleta no refirió dolor durante la evaluación de rangos articulares.');
    else if (v <= 2)
      r.eva.push(`El atleta refirió ${label.toLowerCase()} durante la prueba de movilidad (EVA ${v}/10), dentro de un rango leve.`);
    else if (v <= 4)
      r.eva.push(`El atleta refirió ${label.toLowerCase()} (EVA ${v}/10) durante la prueba de movilidad articular.`);
    else if (v <= 6)
      r.eva.push(`El atleta refirió ${label.toLowerCase()} (EVA ${v}/10). Se recomienda evaluación adicional de las articulaciones comprometidas.`);
    else if (v <= 8)
      r.eva.push(`El atleta refirió ${label.toLowerCase()} (EVA ${v}/10). Se sugiere limitar la actividad física hasta nueva evaluación médica.`);
    else
      r.eva.push(`El atleta refirió ${label.toLowerCase()} (EVA ${v}/10). Se recomienda atención médica prioritaria antes de continuar la actividad deportiva.`);
  }

  // Sit-to-Stand
  const sts = indicators.sts;
  if (sts?.reps && sts?.status && STS_TEXT[sts.status])
    r.sts.push(STS_TEXT[sts.status](sts.reps));

  // Dinamómetro
  const d = indicators.dinamometro;
  if (d?.derecha || d?.izquierda) {
    const ambas = d.derecha && d.izquierda;
    if (ambas && d.derecha === 'normal' && d.izquierda === 'normal')
      r.dinamometro.push('La fuerza de prensión manual evaluada con dinamómetro es normal en ambas manos, lo que indica una adecuada capacidad funcional de los miembros superiores.');
    else if (ambas && d.derecha === 'deficit' && d.izquierda === 'deficit')
      r.dinamometro.push('La fuerza de prensión manual evaluada con dinamómetro presenta déficit en ambas manos. Se recomienda un programa de fortalecimiento de miembro superior.');
    else if (ambas && d.derecha === 'normal' && d.izquierda === 'deficit')
      r.dinamometro.push('La fuerza de prensión es normal en mano derecha y presenta déficit en mano izquierda. Se recomienda ejercicio de fortalecimiento focalizado en el lado izquierdo.');
    else if (ambas && d.derecha === 'deficit' && d.izquierda === 'normal')
      r.dinamometro.push('La fuerza de prensión presenta déficit en mano derecha y es normal en mano izquierda. Se recomienda ejercicio de fortalecimiento focalizado en el lado derecho.');
    else if (d.derecha)
      r.dinamometro.push(`Fuerza de prensión mano derecha: ${d.derecha === 'normal' ? 'dentro de los parámetros normales' : 'con déficit detectado'}.`);
    else if (d.izquierda)
      r.dinamometro.push(`Fuerza de prensión mano izquierda: ${d.izquierda === 'normal' ? 'dentro de los parámetros normales' : 'con déficit detectado'}.`);
  }

  // Notas por módulo — se añaden al final de cada sección en cursiva
  if (notas.vitales)      r.vitales.push('__nota__' + notas.vitales);
  if (notas.rangos)       r.rangos.push('__nota__' + notas.rangos);
  if (notas.eva)          r.eva.push('__nota__' + notas.eva);
  if (notas.fuerza)       r.fuerza.push('__nota__' + notas.fuerza);
  if (notas.adams)        r.adams.push('__nota__' + notas.adams);
  if (notas.flexibilidad) r.flexibilidad.push('__nota__' + notas.flexibilidad);
  if (notas.sts)          r.sts.push('__nota__' + notas.sts);
  if (notas.dinamometro)  r.dinamometro.push('__nota__' + notas.dinamometro);

  return r;
}

export default function Home() {
  const [patientData, setPatientData] = useState({ name: '', age: '', genero: '', email: '', id: '', phone: '' });

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
    adams: {
      columna: 'normal', gibaToracica: '', prominenciaLumbar: ''
    },
    flexibilidad: {
      psoas: 'normal', cuadriceps: 'normal', isquiotibiales: 'normal'
    },
    eva: null,
    sts: { reps: '', status: '' },
    dinamometro: { derecha: 'normal', izquierda: 'normal' },
    observations: ''
  });

  const [stsTimer, setStsTimer] = useState({ active: false, timeLeft: 60 });

  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [specialist, setSpecialist] = useState({ nombre: '', rol: '' });
  const [evaluacionId, setEvaluacionId] = useState(null);
  const [showStsRef, setShowStsRef] = useState(false);
  const [notas, setNotas] = useState({ vitales: '', rangos: '', eva: '', fuerza: '', adams: '', flexibilidad: '', sts: '', dinamometro: '' });
  const [notaModal, setNotaModal] = useState({ open: false, modulo: null });

  const NotaBtn = ({ modulo }) => (
    <button
      className={`nota-btn ${notas[modulo] ? 'has-nota' : ''}`}
      onClick={() => setNotaModal({ open: true, modulo })}
      title={notas[modulo] ? 'Ver/editar nota' : 'Agregar nota al especialista'}
    >
      <FiEdit2 size={15} />
    </button>
  );

  // Pre-evaluación
  const [view, setView] = useState('pre-eval');           // 'pre-eval' | 'form'
  const [formMode, setFormMode] = useState('new');        // 'new' | 'existing'
  const [patientFound, setPatientFound] = useState(null);
  const [cedulaBusqueda, setCedulaBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [pacienteNoEncontrado, setPacienteNoEncontrado] = useState(false);

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

const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setSpecialist({
          id:     data.user.id,
          nombre: data.user.user_metadata?.nombre || '',
          rol:    data.user.user_metadata?.rol    || '',
        });
      }
    });
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

  const handleAdams = (field, value) => {
    const newAdams = { ...indicators.adams, [field]: value };
    if (field === 'columna' && value === 'normal') {
      newAdams.gibaToracica = '';
      newAdams.prominenciaLumbar = '';
    }
    setIndicators({ ...indicators, adams: newAdams });
  };

  const handleFlexibilidad = (muscle, value) => {
    setIndicators({ ...indicators, flexibilidad: { ...indicators.flexibilidad, [muscle]: value } });
  };

  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = 880;
        const start = ctx.currentTime + i * 0.6;
        osc.start(start);
        osc.stop(start + 0.4);
      }
    } catch (e) { /* silencioso si el navegador bloquea audio */ }
  };

  useEffect(() => {
    if (!stsTimer.active) return;
    if (stsTimer.timeLeft === 0) {
      setStsTimer(t => ({ ...t, active: false }));
      beep();
      return;
    }
    const id = setInterval(() =>
      setStsTimer(t => ({ ...t, timeLeft: t.timeLeft - 1 })), 1000);
    return () => clearInterval(id);
  }, [stsTimer.active, stsTimer.timeLeft]);

  const buscarPaciente = async () => {
    if (!cedulaBusqueda.trim()) return;
    setBuscando(true);
    setPacienteNoEncontrado(false);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data } = await supabase
      .from('pacientes')
      .select('*')
      .eq('cedula', cedulaBusqueda.trim())
      .single();
    setBuscando(false);
    if (data) {
      setPatientFound(data);
      setPatientData({
        name:   data.nombre   || '',
        age:    data.edad     || '',
        genero: data.genero   || '',
        email:  data.correo   || '',
        id:     data.cedula   || '',
        phone:  data.telefono || '',
      });
      setFormMode('existing');
      setView('form');
    } else {
      setPacienteNoEncontrado(true);
    }
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
        '.pdf-header, .pdf-patient-box, .pdf-nl-section, .pdf-signatures, .pdf-partner-banner'
      );
      const breakPoints = Array.from(sectionEls)
        .map(el => Math.round((el.getBoundingClientRect().top - containerTop) * scale))
        .filter(px => px > 0)
        .sort((a, b) => a - b);

      // Pre-calculate banner position in canvas pixels for the link annotation
      const bannerEl = pdfRef.current.querySelector('.pdf-partner-banner');
      let bannerTopPx = null, bannerHeightPx = null;
      if (bannerEl) {
        const r = bannerEl.getBoundingClientRect();
        bannerTopPx = Math.round((r.top - containerTop) * scale);
        bannerHeightPx = Math.round(r.height * scale);
      }

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

        // Add clickable link over the banner if it falls on this page
        if (bannerTopPx !== null && bannerTopPx < yPx + sliceHeightPx && bannerTopPx + bannerHeightPx > yPx) {
          const offsetInPageMm = margin + Math.max(bannerTopPx - yPx, 0) / pxPerMm;
          const linkHeightMm = bannerHeightPx / pxPerMm;
          pdf.link(margin, offsetInPageMm, contentWidth, linkHeightMm, { url: 'https://fenixsalud.com.ve/' });
        }

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

  const guardarEvaluacion = async () => {
    if (evaluacionId) return; // Ya guardado en esta sesión
    const newId = crypto.randomUUID();
    try {
      const res = await fetch('/api/save-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: newId, patientData, indicators, notas, specialist }),
      });
      if (res.ok) {
        setEvaluacionId(newId);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Error guardando evaluación:', err);
      }
    } catch (e) {
      console.error('Error guardando evaluación:', e);
    }
  };

  const downloadPDF = async () => {
    const pdf = await generatePDF();
    if (pdf) {
      await guardarEvaluacion();
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
      await guardarEvaluacion();
      const base64PDF = pdf.output('datauristring').split(',')[1];
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: patientData.email,
          patientName: patientData.name,
          pdfBase64: base64PDF,
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

      {specialist.nombre && (
        <div className="specialist-topbar">
          <div className="specialist-topbar-inner">
            <span className="specialist-info">
              <FiUser size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle', opacity: 0.85 }} />
              <span className="specialist-hola">Hola, </span><strong>{specialist.nombre}</strong>
              {specialist.rol && <span className="specialist-rol"> · {specialist.rol.charAt(0).toUpperCase() + specialist.rol.slice(1)}</span>}
            </span>
            <div className="specialist-topbar-actions">
              {view === 'form' && (
                <button
                  className="topbar-home-btn"
                  title="Ir al inicio"
                  aria-label="Ir al inicio"
                  onClick={() => {
                    setPatientData({ name: '', age: '', genero: '', email: '', id: '', phone: '' });
                    setView('pre-eval');
                    setPatientFound(null);
                    setCedulaBusqueda('');
                  }}
                >
                  <FiHome size={16} />
                </button>
              )}
              <form action="/api/auth/logout" method="POST">
                <button type="submit" className="btn-logout">
                  <FiLogOut size={14} /> Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Pantalla pre-evaluación ─────────────────────────────────────── */}
      {view === 'pre-eval' && (
        <div className="pre-eval-page">
          <div className="pre-eval-specialist-card">
            <div className="pre-eval-specialist-avatar" aria-hidden="true">
              <FiUser size={44} />
            </div>
            <p className="pre-eval-welcome">
              Hola, <strong>{specialist.nombre || 'Especialista'}</strong>
            </p>
            {specialist.rol && (
              <p className="pre-eval-rol">
                {specialist.rol.charAt(0).toUpperCase() + specialist.rol.slice(1)}
              </p>
            )}
          </div>

          <div className="pre-eval-options">
            {/* Opción A: Nueva evaluación */}
            <div className="pre-eval-option">
              <div className="pre-eval-option-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <h3 className="pre-eval-option-title">Nueva evaluación</h3>
              <p className="pre-eval-option-desc">El atleta no ha sido evaluado previamente por ningún especialista</p>
              <button
                className="btn btn-primary pre-eval-option-btn"
                onClick={() => {
                  setPatientData({ name: '', age: '', genero: '', email: '', id: '', phone: '' });
                  setFormMode('new');
                  setView('form');
                }}
              >
                Comenzar
              </button>
            </div>

            {/* Opción B: Continuar evaluación */}
            <div className="pre-eval-option">
              <div className="pre-eval-option-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h3 className="pre-eval-option-title">Continuar evaluación</h3>
              <p className="pre-eval-option-desc">El atleta ya fue evaluado por otro especialista</p>
              <div className="pre-eval-search">
                <label htmlFor="cedula-busqueda" className="sr-only">Número de cédula</label>
                <input
                  id="cedula-busqueda"
                  type="text"
                  placeholder="Número de cédula"
                  value={cedulaBusqueda}
                  onChange={e => { setCedulaBusqueda(e.target.value); setPacienteNoEncontrado(false); }}
                  onKeyDown={e => e.key === 'Enter' && buscarPaciente()}
                  aria-describedby={pacienteNoEncontrado ? 'cedula-error' : undefined}
                />
                <button
                  className="btn btn-primary"
                  onClick={buscarPaciente}
                  disabled={buscando || !cedulaBusqueda.trim()}
                  aria-label={buscando ? 'Buscando paciente...' : 'Buscar paciente por cédula'}
                >
                  {buscando ? (
                    <svg className="login-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : 'Buscar'}
                </button>
              </div>
              {pacienteNoEncontrado && (
                <div className="pre-eval-not-found" id="cedula-error" role="alert">
                  <p>Paciente no encontrado con esa cédula.</p>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { setFormMode('new'); setView('form'); }}
                  >
                    Crear nueva evaluación
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Formulario de evaluación ─────────────────────────────────────── */}
      {view === 'form' && (
      <>

      <header className="main-header">
        <div className="header-logo-area">
          <img src="/SilverGame_Logo.png" alt="Silvers Games" className="header-logo" />
        </div>
        <h1>Evaluación Física</h1>
        <p>Completa el formulario de evaluación para generar el informe del atleta</p>
      </header>

      {/* Tarjeta de paciente existente */}
      {formMode === 'existing' && patientFound && (
        <div className="patient-info-bar">
          <div className="patient-info-data">
            <FiUser size={16} />
            <strong>{patientFound.nombre}</strong>
            <span className="patient-info-sep">·</span>
            <span>Cédula: {patientFound.cedula}</span>
            {patientFound.edad && <><span className="patient-info-sep">·</span><span>{patientFound.edad} años</span></>}
            {patientFound.correo && <><span className="patient-info-sep">·</span><span>{patientFound.correo}</span></>}
            {patientFound.telefono && <><span className="patient-info-sep">·</span><span>{patientFound.telefono}</span></>}
          </div>
        </div>
      )}

      {formMode === 'new' && <div className="card">
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
            <label>Género</label>
            <select value={patientData.genero} onChange={(e) => setPatientData({ ...patientData, genero: e.target.value })}>
              <option value="">Seleccionar...</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </select>
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
      </div>}

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiActivity /></span>
          <h2>Indicadores Cardiovasculares y Oximetría</h2>
          <NotaBtn modulo="vitales" />
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
          <NotaBtn modulo="rangos" />
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

      {/* Escala de Dolor EVA */}
      <div className="card">
        <div className="card-header">
          <span className="section-number"><BiFace size={20} /></span>
          <h2>Escala de Dolor (EVA)</h2>
          <NotaBtn modulo="eva" />
        </div>
        <p className="mb-3" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Pregunta al atleta cuánto dolor siente tras la prueba de movilidad articular y selecciona el valor correspondiente.
        </p>

        {/* Íconos de caras */}
        <div className="eva-faces-row">
          {EVA_CATS.map((cat) => {
            const active = indicators.eva !== null && indicators.eva >= cat.range[0] && indicators.eva <= cat.range[1];
            return (
              <button key={cat.label} className={`eva-face-btn ${active ? 'active' : ''}`}
                style={active ? { color: cat.color, borderColor: cat.color, background: cat.bg } : {}}
                onClick={() => setIndicators({ ...indicators, eva: cat.selectVal })}
                title={cat.label}
              >
                <cat.Icon size={36} />
                <span className="eva-face-label" style={active ? { color: cat.color } : {}}>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Barra numérica 0–10 */}
        <div className="eva-num-row">
          {EVA_NUM_COLORS.map((color, i) => {
            const active = indicators.eva === i;
            return (
              <button key={i} className={`eva-num-btn ${active ? 'active' : ''}`}
                style={{ '--eva-color': color, ...(active ? { background: color, color: '#fff', borderColor: color } : {}) }}
                onClick={() => setIndicators({ ...indicators, eva: i })}
              >{i}</button>
            );
          })}
        </div>

        {/* Resultado activo */}
        {(() => {
          const cat = getEvaCat(indicators.eva);
          return cat ? (
            <div className="eva-result" style={{ borderColor: cat.color, background: cat.bg }}>
              <span className="eva-result-value" style={{ color: cat.color }}>EVA {indicators.eva}/10</span>
              <span className="eva-result-label" style={{ color: cat.color }}>{cat.label}</span>
            </div>
          ) : (
            <p className="eva-placeholder">Sin selección — toca una cara o un número para registrar el dolor</p>
          );
        })()}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiZap /></span>
          <h2>Fuerza Muscular (Escala Daniels)</h2>
          <NotaBtn modulo="fuerza" />
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
          <span className="section-number"><FiAlignCenter /></span>
          <h2>Prueba de Adams</h2>
          <NotaBtn modulo="adams" />
        </div>
        <div className="form-group" style={{ marginBottom: indicators.adams.columna === 'escoliosis' ? '1rem' : 0 }}>
          <label>Columna vertebral</label>
          <div className="status-selector adams-full">
            <button className={`status-btn ${indicators.adams.columna === 'normal' ? 'active normal' : ''}`} onClick={() => handleAdams('columna', 'normal')}>Normal (-)</button>
            <button className={`status-btn ${indicators.adams.columna === 'escoliosis' ? 'active exceso' : ''}`} onClick={() => handleAdams('columna', 'escoliosis')}>Escoliosis (+)</button>
          </div>
        </div>
        {indicators.adams.columna === 'escoliosis' && (
          <div className="adams-sub-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Giba torácica</label>
              <div className="status-selector adams-full">
                <button className={`status-btn ${indicators.adams.gibaToracica === 'derecha' ? 'active deficit' : ''}`} onClick={() => handleAdams('gibaToracica', 'derecha')}>Derecha</button>
                <button className={`status-btn ${indicators.adams.gibaToracica === 'izquierda' ? 'active deficit' : ''}`} onClick={() => handleAdams('gibaToracica', 'izquierda')}>Izquierda</button>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Prominencia lumbar</label>
              <div className="status-selector adams-full">
                <button className={`status-btn ${indicators.adams.prominenciaLumbar === 'derecha' ? 'active deficit' : ''}`} onClick={() => handleAdams('prominenciaLumbar', 'derecha')}>Derecha</button>
                <button className={`status-btn ${indicators.adams.prominenciaLumbar === 'izquierda' ? 'active deficit' : ''}`} onClick={() => handleAdams('prominenciaLumbar', 'izquierda')}>Izquierda</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiRotateCw /></span>
          <h2>Flexibilidad</h2>
          <NotaBtn modulo="flexibilidad" />
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
          <span className="section-number">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><line x1="12" y1="12" x2="12" y2="12.01"/>
            </svg>
          </span>
          <h2>Sit-to-Stand Test (60 seg)</h2>
          <div className="card-header-actions">
            <button className="sts-ref-btn" onClick={() => setShowStsRef(true)} title="Ver tabla de referencia">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Ver referencia
            </button>
            <NotaBtn modulo="sts" />
          </div>
        </div>

        {/* Modal tabla de referencia STS */}
        {showStsRef && (
          <div className="sts-ref-overlay" onClick={() => setShowStsRef(false)}>
            <div className="sts-ref-modal" onClick={e => e.stopPropagation()}>
              <div className="sts-ref-modal-header">
                <div>
                  <h3>Valores de referencia — STS 1 minuto</h3>
                  <p>Otto-Yáñez et al. 2025 · Población latinoamericana · PLoS One</p>
                </div>
                <button className="sts-ref-close" onClick={() => setShowStsRef(false)}>✕</button>
              </div>
              <div className="sts-ref-table-wrap">
                <table className="sts-ref-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">Grupo etario</th>
                      <th colSpan="5">Mujeres</th>
                      <th colSpan="5">Hombres</th>
                    </tr>
                    <tr>
                      <th>P2.5</th><th className="sts-p25">P25</th><th>P50</th><th>P75</th><th>P97.5</th>
                      <th>P2.5</th><th className="sts-p25">P25</th><th>P50</th><th>P75</th><th>P97.5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STS_NORMS.femenino.map((rowF, ri) => {
                      const rowM = STS_NORMS.masculino[ri];
                      return (
                        <tr key={rowF.label}>
                          <td className="sts-ref-group">{rowF.label}</td>
                          {rowF.p.map((v, i) => <td key={i} className={i === 1 ? 'sts-p25' : ''}>{v}</td>)}
                          {rowM.p.map((v, i) => <td key={i} className={i === 1 ? 'sts-p25' : ''}>{v}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="sts-ref-note">El umbral P25 se usa como mínimo para clasificar <strong>Normal</strong>. Por debajo de P25 = <strong>Déficit</strong>.</p>
            </div>
          </div>
        )}
        <p className="mb-3" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Inicia el cronómetro y cuenta las repeticiones del atleta. Al finalizar el tiempo, registra el número de repeticiones completadas y selecciona el resultado correspondiente.
        </p>

        {/* Cronómetro */}
        <div className="sts-timer-wrap">
          <p className="sts-timer-label">Tiempo restante</p>
          <div className={`sts-countdown${stsTimer.timeLeft === 0 ? ' sts-done' : ''}`}>
            {String(Math.floor(stsTimer.timeLeft / 60)).padStart(1,'0')}:{String(stsTimer.timeLeft % 60).padStart(2,'0')}
          </div>
          {stsTimer.timeLeft === 0 && <p className="sts-timer-done-label">¡Tiempo completado!</p>}
          <div className="sts-timer-btns">
            <button
              className="sts-timer-btn sts-timer-btn-primary"
              onClick={() => setStsTimer(t => ({ ...t, active: !t.active }))}
              disabled={stsTimer.timeLeft === 0}
            >
              {stsTimer.active
                ? <><FiPause size={16} /> Pausar</>
                : <><FiPlay size={16} /> {stsTimer.timeLeft < 60 ? 'Continuar' : 'Iniciar'}</>
              }
            </button>
            <button
              className="sts-timer-btn sts-timer-btn-ghost"
              onClick={() => setStsTimer({ active: false, timeLeft: 60 })}
            >
              <FiRotateCw size={15} /> Reiniciar
            </button>
          </div>
        </div>

        {/* Repeticiones y resultado */}
        <div className="sts-result-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Repeticiones completadas</label>
            <input
              type="number" min="0" placeholder="Nº repeticiones"
              value={indicators.sts.reps}
              onChange={e => {
                const reps = e.target.value;
                const autoStatus = calcStsStatus(reps, patientData.age, patientData.genero);
                setIndicators({ ...indicators, sts: { reps, status: autoStatus || indicators.sts.status } });
              }}
            />
            {(() => {
              const norm = getStsNorm(patientData.age, patientData.genero);
              return norm ? (
                <p className="sts-norm-hint">
                  Referencia ({patientData.genero || 'N/A'}, {patientData.age} años): ≥ {norm.p[1]} reps para Normal
                </p>
              ) : null;
            })()}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Resultado</label>
            <div className="status-selector adams-full sts-result-selector">
              <button className={`status-btn ${indicators.sts.status === 'normal' ? 'active normal' : ''}`} onClick={() => setIndicators({ ...indicators, sts: { ...indicators.sts, status: 'normal' } })}>Normal</button>
              <button className={`status-btn ${indicators.sts.status === 'deficit' ? 'active deficit' : ''}`} onClick={() => setIndicators({ ...indicators, sts: { ...indicators.sts, status: 'deficit' } })}>Déficit</button>
            </div>
          </div>
        </div>

        {/* Panel de resultados por percentil */}
        {(() => {
          const perc = getStsPercentile(indicators.sts.reps, patientData.age, patientData.genero);
          if (!perc) return null;
          const { norm, band } = perc;
          const percLabels = ['P2.5', 'P25', 'P50', 'P75', 'P97.5'];
          const generoLabel = patientData.genero?.charAt(0).toUpperCase() + patientData.genero?.slice(1);
          return (
            <div className="sts-results-panel">
              <div className="sts-results-cards">
                <div className="sts-result-card">
                  <span className="sts-result-card-label">Grupo Etario</span>
                  <span className="sts-result-card-value neutral">{norm.label} años</span>
                </div>
                <div className="sts-result-card" style={{ borderColor: band.color, background: band.bg }}>
                  <span className="sts-result-card-label">Percentil Alcanzado</span>
                  <span className="sts-result-card-value" style={{ color: band.color }}>{band.label}</span>
                </div>
                <div className="sts-result-card sts-result-card-interp">
                  <span className="sts-result-card-label">Interpretación Clínica</span>
                  <span className="sts-result-card-text" style={{ color: band.color }}>{band.text}</span>
                </div>
              </div>
              <div className="sts-mini-table-wrap">
                <p className="sts-mini-table-title">Tabla de referencia — {generoLabel} · {norm.label} años (Otto-Yáñez et al. 2025)</p>
                <table className="sts-mini-table">
                  <thead>
                    <tr>
                      <th>Percentil</th>
                      {percLabels.map(l => <th key={l} className={l === 'P25' ? 'sts-p25' : ''}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="sts-ref-group">{norm.label} años</td>
                      {norm.p.map((v, i) => (
                        <td key={i}
                          className={i === 1 ? 'sts-p25' : ''}
                          style={i === band.colIdx ? { background: band.bg, color: band.color, fontWeight: 700 } : {}}
                        >{v}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-number"><FiActivity /></span>
          <h2>Fuerza de Presión con Dinamómetro</h2>
          <NotaBtn modulo="dinamometro" />
        </div>
        <div className="flex-col gap-4">
          {[
            { key: 'derecha',   label: 'Mano Derecha' },
            { key: 'izquierda', label: 'Mano Izquierda' },
          ].map(({ key, label }) => (
            <div key={key} className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>{label}</label>
              <div className="status-selector adams-full">
                <button
                  className={`status-btn ${indicators.dinamometro[key] === 'normal' ? 'active normal' : ''}`}
                  onClick={() => setIndicators({ ...indicators, dinamometro: { ...indicators.dinamometro, [key]: 'normal' } })}
                >Normal</button>
                <button
                  className={`status-btn ${indicators.dinamometro[key] === 'deficit' ? 'active deficit' : ''}`}
                  onClick={() => setIndicators({ ...indicators, dinamometro: { ...indicators.dinamometro, [key]: 'deficit' } })}
                >Déficit</button>
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

      {/* Modal de notas por módulo */}
      {notaModal.open && (
        <div className="nota-overlay" onClick={() => setNotaModal({ open: false, modulo: null })}>
          <div className="nota-modal" onClick={e => e.stopPropagation()}>
            <div className="nota-modal-header">
              <h3>Nota — {MODULO_LABELS[notaModal.modulo]}</h3>
              <button className="nota-close" onClick={() => setNotaModal({ open: false, modulo: null })}>✕</button>
            </div>
            <textarea
              className="nota-textarea"
              placeholder="Escribe observaciones específicas de este módulo..."
              value={notas[notaModal.modulo] || ''}
              onChange={e => setNotas({ ...notas, [notaModal.modulo]: e.target.value })}
              rows={5}
              autoFocus
            />
            <p className="nota-hint">Se guarda automáticamente al cerrar el modal</p>
          </div>
        </div>
      )}

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
            const report = buildReport(indicators, notas);
            const sections = [
              { title: 'Signos Vitales', items: report.vitales },
              { title: 'Rangos Articulares', items: report.rangos },
              { title: 'Fuerza Muscular', items: report.fuerza },
              { title: 'Prueba de Adams', items: report.adams },
              { title: 'Flexibilidad', items: report.flexibilidad },
              { title: 'Escala de Dolor (EVA)', items: report.eva },
              { title: 'Prueba Funcional (Sit-to-Stand)', items: report.sts },
              { title: 'Fuerza de Presión (Dinamómetro)', items: report.dinamometro },
            ];
            return sections.map(({ title, items }) =>
              items.length > 0 && (
                <div key={title} className="pdf-nl-section">
                  <div className="pdf-nl-title">{title}</div>
                  {items.map((p, i) =>
                    p.startsWith('__nota__')
                      ? <p key={i} className="pdf-nl-para pdf-nl-nota">{p.replace('__nota__', '')}</p>
                      : <p key={i} className="pdf-nl-para">{p}</p>
                  )}
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

          {/* Firmas y banner temporalmente ocultos para demo */}

        </div>
      </div>
      </>
      )}
    </div >
  );
}
