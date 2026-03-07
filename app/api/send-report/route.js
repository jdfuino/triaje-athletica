import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, patientName, pdfBase64 } = body;

        if (!email || !pdfBase64) {
            return NextResponse.json({ error: 'Faltan datos requeridos (email o pdf)' }, { status: 400 });
        }

        // Configurando el servicio de correo (Para desarrollo usando Ethereal)
        // En producción cambiar por credenciales reales SMTP (ej. SendGrid, Gmail)
        const testAccount = await nodemailer.createTestAccount();

        // Configuración del tranporte con Ethereal en entorno de desarrollo.
        // Si tienes cuenta real, cambia estas credenciales
        const transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user, // generated ethereal user
                pass: testAccount.pass, // generated ethereal password
            },
        });

        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        const info = await transporter.sendMail({
            from: '"Dra. Fisiatra - Silvers Games" <evaluaciones@silversgames.com>', // sender address
            to: email, // list of receivers
            subject: `Reporte de Evaluación Fisiátrica - ${patientName || 'Paciente'}`, // Subject line
            text: `Hola ${patientName || ''},\n\nAdjunto encontrarás el reporte de tu última evaluación fisiátrica.\n\nSaludos,\nDra. Fisiatra`, // plain text body
            html: `<p>Hola <strong>${patientName || ''}</strong>,</p><p>Adjunto encontrarás el reporte detallado de tu última evaluación fisiátrica.</p><p>Saludos cordiales,<br/>Dra. Fisiatra</p>`, // html body
            attachments: [
                {
                    filename: `Evaluacion_${patientName || 'SilversGames'}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });

        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

        return NextResponse.json({
            success: true,
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info)
        });

    } catch (error) {
        console.error('Error enviando email:', error);
        return NextResponse.json({ error: 'Error interno del servidor enviando el correo' }, { status: 500 });
    }
}
