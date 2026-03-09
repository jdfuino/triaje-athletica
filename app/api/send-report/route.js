import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

function getLogoBuffer() {
    try {
        const logoPath = path.join(process.cwd(), 'public', 'SilverGame_Logo.png');
        return fs.readFileSync(logoPath);
    } catch {
        return null;
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, patientName, pdfBase64 } = body;

        if (!email || !pdfBase64) {
            return NextResponse.json({ error: 'Faltan datos requeridos (email o pdf)' }, { status: 400 });
        }

        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        const logoBuffer = getLogoBuffer();
        const attachments = [];
        if (logoBuffer) {
            attachments.push({ filename: 'logo.png', content: logoBuffer, content_type: 'image/png', content_id: 'logo', inline: true });
        }
        attachments.push({ filename: `Evaluacion_${patientName || 'SilversGames'}.pdf`, content: pdfBuffer });

        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: email,
            subject: `Informe de Evaluación Física — ${patientName || 'Atleta'} | Silvers Games`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
                    <div style="background: linear-gradient(135deg, #05254F, #06b6d4); padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
                        ${logoBuffer ? '<img src="cid:logo" alt="Silvers Games" style="height: 90px; width: auto; object-fit: contain;" />' : ''}
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
            attachments,
        });

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, messageId: data.id });

    } catch (error) {
        console.error('Error enviando email:', error);
        return NextResponse.json({ error: 'Error interno del servidor enviando el correo' }, { status: 500 });
    }
}
