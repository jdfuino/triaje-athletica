import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req) {
    try {
        const body = await req.json();
        const { evaluacionId, patientData, indicators, specialist } = body;

        if (!patientData?.id) {
            return NextResponse.json({ error: 'Cédula del paciente requerida' }, { status: 400 });
        }

        // Upsert paciente
        const { error: patError } = await supabaseAdmin.from('pacientes').upsert({
            cedula:   patientData.id,
            nombre:   patientData.name   || null,
            correo:   patientData.email  || null,
            telefono: patientData.phone  || null,
            edad:     patientData.age    || null,
            genero:   patientData.genero || null,
        }, { onConflict: 'cedula' });
        if (patError) console.error('Supabase pacientes upsert error:', patError.message);

        // Insert evaluación física con UUID generado en cliente
        const { error: dbError } = await supabaseAdmin
            .from('evaluacion_fisica')
            .insert([{
                id:                         evaluacionId,
                cedula:                     patientData.id || null,
                fecha:                      new Date().toISOString().split('T')[0],
                pa_sys:                     indicators.pa?.sys ? parseInt(indicators.pa.sys) : null,
                pa_dia:                     indicators.pa?.dia ? parseInt(indicators.pa.dia) : null,
                pa_status:                  indicators.pa?.status || null,
                fc_value:                   indicators.fc?.value ? parseInt(indicators.fc.value) : null,
                fc_status:                  indicators.fc?.status || null,
                spo2_value:                 indicators.spo2?.value ? parseInt(indicators.spo2.value) : null,
                spo2_status:                indicators.spo2?.status || null,
                rangos_hombros:             indicators.rangos?.hombros || null,
                rangos_codos:               indicators.rangos?.codos || null,
                rangos_munecas:             indicators.rangos?.munecas || null,
                rangos_caderas:             indicators.rangos?.caderas || null,
                rangos_rodillas:            indicators.rangos?.rodillas || null,
                rangos_tobillos:            indicators.rangos?.tobillos || null,
                fuerza_deltoides:           indicators.fuerza?.deltoides ? parseInt(indicators.fuerza.deltoides) : null,
                fuerza_estabilizadores_esc: indicators.fuerza?.estabilizadoresEsc ? parseInt(indicators.fuerza.estabilizadoresEsc) : null,
                fuerza_rotadores_homb:      indicators.fuerza?.rotadoresHomb ? parseInt(indicators.fuerza.rotadoresHomb) : null,
                fuerza_zona_media:          indicators.fuerza?.zonaMedia ? parseInt(indicators.fuerza.zonaMedia) : null,
                fuerza_gluteos:             indicators.fuerza?.gluteos ? parseInt(indicators.fuerza.gluteos) : null,
                fuerza_isquiotibiales:      indicators.fuerza?.isquiotibiales ? parseInt(indicators.fuerza.isquiotibiales) : null,
                fuerza_cuadriceps:          indicators.fuerza?.cuadriceps ? parseInt(indicators.fuerza.cuadriceps) : null,
                fuerza_flexores_cadera:     indicators.fuerza?.flexoresCadera ? parseInt(indicators.fuerza.flexoresCadera) : null,
                fuerza_estabilizadores_tob: indicators.fuerza?.estabilizadoresTob ? parseInt(indicators.fuerza.estabilizadoresTob) : null,
                adams_columna:              indicators.adams?.columna || null,
                adams_giba_toracica:        indicators.adams?.gibaToracica || null,
                adams_prominencia_lumbar:   indicators.adams?.prominenciaLumbar || null,
                flex_psoas:                 indicators.flexibilidad?.psoas || null,
                flex_cuadriceps:            indicators.flexibilidad?.cuadriceps || null,
                flex_isquiotibiales:        indicators.flexibilidad?.isquiotibiales || null,
                eva_dolor:                  indicators.eva !== null && indicators.eva !== undefined ? parseInt(indicators.eva) : null,
                sts_reps:                   indicators.sts?.reps ? parseInt(indicators.sts.reps) : null,
                sts_status:                 indicators.sts?.status || null,
                dinamometro_derecha:        indicators.dinamometro?.derecha   || null,
                dinamometro_izquierda:      indicators.dinamometro?.izquierda || null,
                observaciones:              indicators.observations || null,
                specialist_id:              specialist?.id     || null,
                specialist_nombre:          specialist?.nombre || null,
                specialist_rol:             specialist?.rol    || null,
            }]);

        if (dbError) {
            console.error('Supabase insert error:', dbError.message);
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, evaluacionId });

    } catch (error) {
        console.error('Error guardando evaluación:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
