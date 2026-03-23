import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const LOGO_URL = 'https://digimedven.com/silvergames/SilverGame_Logo.png';

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, patientName, pdfBase64, patientData, indicators, fecha, specialist } = body;

        if (!email || !pdfBase64) {
            return NextResponse.json({ error: 'Faltan datos requeridos (email o pdf)' }, { status: 400 });
        }

        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: email,
            subject: `Informe de Evaluación Física — ${patientName || 'Atleta'} | Silvers Games`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
                    <div style="background: linear-gradient(135deg, #05254F, #06b6d4); padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
                        <img src="${LOGO_URL}" alt="Silvers Games" style="height: 90px; width: auto; object-fit: contain;" />
                        <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0; font-size: 14px;">Evaluación Física</p>
                    </div>
                    <div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e2e8f0; border-top: none;">
                        <p style="font-size: 16px;">Hola <strong>${patientName || 'atleta'}</strong>,</p>
                        <p style="color: #64748b; line-height: 1.6;">
                            Adjunto a este correo encontrarás tu <strong>informe de evaluación física</strong>
                            realizado durante el evento Silvers Games.
                        </p>
                        <p style="color: #64748b; line-height: 1.6;">
                            Te recomendamos guardar este documento para tus registros médicos y compartirlo
                            con tu médico de confianza si tienes alguna consulta adicional.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                        <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                            Este correo fue enviado automáticamente por el sistema de triaje de Silvers Games.<br/>
                            Por favor no respondas a este mensaje.
                        </p>
                    </div>
                </div>
            `,
            attachments: [
                { filename: `Evaluacion_${patientName || 'SilversGames'}.pdf`, content: pdfBuffer }
            ],
        });

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Guardar evaluación en Supabase (no bloquea el flujo si falla)
        if (patientData && indicators) {
            // Upsert datos del paciente en tabla pacientes
            if (patientData.id) {
                const { error: patError } = await supabaseAdmin.from('pacientes').upsert({
                    cedula:   patientData.id,
                    nombre:   patientData.name   || null,
                    correo:   patientData.email  || null,
                    telefono: patientData.phone  || null,
                    edad:     patientData.age    || null,
                    genero:   patientData.genero || null,
                }, { onConflict: 'cedula' });
                if (patError) console.error('Supabase pacientes upsert error:', patError.message);
            }

            // Insert evaluación clínica (sin datos del paciente)
            const { error: dbError } = await supabaseAdmin.from('evaluacion_fisica').insert([{
                cedula: patientData.id || null,
                fecha: new Date().toISOString().split('T')[0],
                pa_sys: indicators.pa?.sys ? parseInt(indicators.pa.sys) : null,
                pa_dia: indicators.pa?.dia ? parseInt(indicators.pa.dia) : null,
                pa_status: indicators.pa?.status || null,
                fc_value: indicators.fc?.value ? parseInt(indicators.fc.value) : null,
                fc_status: indicators.fc?.status || null,
                spo2_value: indicators.spo2?.value ? parseInt(indicators.spo2.value) : null,
                spo2_status: indicators.spo2?.status || null,
                rangos_hombros: indicators.rangos?.hombros || null,
                rangos_codos: indicators.rangos?.codos || null,
                rangos_munecas: indicators.rangos?.munecas || null,
                rangos_caderas: indicators.rangos?.caderas || null,
                rangos_rodillas: indicators.rangos?.rodillas || null,
                rangos_tobillos: indicators.rangos?.tobillos || null,
                fuerza_deltoides: indicators.fuerza?.deltoides ? parseInt(indicators.fuerza.deltoides) : null,
                fuerza_estabilizadores_esc: indicators.fuerza?.estabilizadoresEsc ? parseInt(indicators.fuerza.estabilizadoresEsc) : null,
                fuerza_rotadores_homb: indicators.fuerza?.rotadoresHomb ? parseInt(indicators.fuerza.rotadoresHomb) : null,
                fuerza_zona_media: indicators.fuerza?.zonaMedia ? parseInt(indicators.fuerza.zonaMedia) : null,
                fuerza_gluteos: indicators.fuerza?.gluteos ? parseInt(indicators.fuerza.gluteos) : null,
                fuerza_isquiotibiales: indicators.fuerza?.isquiotibiales ? parseInt(indicators.fuerza.isquiotibiales) : null,
                fuerza_cuadriceps: indicators.fuerza?.cuadriceps ? parseInt(indicators.fuerza.cuadriceps) : null,
                fuerza_flexores_cadera: indicators.fuerza?.flexoresCadera ? parseInt(indicators.fuerza.flexoresCadera) : null,
                fuerza_estabilizadores_tob: indicators.fuerza?.estabilizadoresTob ? parseInt(indicators.fuerza.estabilizadoresTob) : null,
                adams_columna: indicators.adams?.columna || null,
                adams_giba_toracica: indicators.adams?.gibaToracica || null,
                adams_prominencia_lumbar: indicators.adams?.prominenciaLumbar || null,
                flex_psoas: indicators.flexibilidad?.psoas || null,
                flex_cuadriceps: indicators.flexibilidad?.cuadriceps || null,
                flex_isquiotibiales: indicators.flexibilidad?.isquiotibiales || null,
                observaciones: indicators.observations || null,
                specialist_id:     specialist?.id     || null,
                specialist_nombre: specialist?.nombre || null,
                specialist_rol:    specialist?.rol    || null,
            }]);
            if (dbError) console.error('Supabase insert error:', dbError.message);
        }

        return NextResponse.json({ success: true, messageId: data.id });

    } catch (error) {
        console.error('Error enviando email:', error);
        return NextResponse.json({ error: 'Error interno del servidor enviando el correo' }, { status: 500 });
    }
}
