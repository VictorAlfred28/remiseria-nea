import aiosmtplib
import logging
import os
from email.message import EmailMessage
from jinja2 import Environment, FileSystemLoader

from app.core.config import settings

logger = logging.getLogger(__name__)

# Template configuration
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "templates", "emails")
jinja_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

async def send_email(to: str, subject: str, html_content: str):
    """
    Sends an HTML email using Gmail SMTP via aiosmtplib.
    """
    if not settings.GMAIL_EMAIL or not settings.GMAIL_APP_PASSWORD:
        logger.warning("Email settings not configured. Skipping email sending.")
        return

    message = EmailMessage()
    message["From"] = f"Viajes NEA <{settings.GMAIL_EMAIL}>"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(html_content, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            username=settings.GMAIL_EMAIL,
            password=settings.GMAIL_APP_PASSWORD,
        )
        logger.info(f"Email successfully sent to {to}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {str(e)}")

async def send_account_registered(to_email: str, nombre: str):
    try:
        template = jinja_env.get_template("registered_pending.html")
        html = template.render(nombre=nombre)
        await send_email(to_email, "Tu cuenta está pendiente de aprobación", html)
    except Exception as e:
        logger.error(f"Email send failed (send_account_registered) for {to_email}: {str(e)}")

async def send_account_approved(to_email: str, nombre: str):
    try:
        template = jinja_env.get_template("account_approved.html")
        login_url = f"{settings.FRONTEND_URL}/login"
        html = template.render(nombre=nombre, login_url=login_url)
        await send_email(to_email, "¡Tu cuenta ha sido aprobada!", html)
    except Exception as e:
        logger.error(f"Email send failed (send_account_approved) for {to_email}: {str(e)}")

async def send_account_rejected(to_email: str, nombre: str):
    try:
        template = jinja_env.get_template("account_rejected.html")
        html = template.render(nombre=nombre)
        await send_email(to_email, "Actualización sobre tu solicitud de cuenta", html)
    except Exception as e:
        logger.error(f"Email send failed (send_account_rejected) for {to_email}: {str(e)}")

async def send_admin_alert(nuevo_usuario_email: str, nuevo_usuario_nombre: str, nuevo_usuario_telefono: str, nuevo_usuario_rol: str):
    try:
        template = jinja_env.get_template("admin_new_user_alert.html")
        admin_url = f"{settings.FRONTEND_URL}/admin/validacion"
        html = template.render(
            nuevo_usuario_nombre=nuevo_usuario_nombre,
            nuevo_usuario_email=nuevo_usuario_email,
            nuevo_usuario_telefono=nuevo_usuario_telefono,
            nuevo_usuario_rol=nuevo_usuario_rol,
            admin_url=admin_url
        )
        admin_email = settings.GMAIL_EMAIL
        if admin_email:
            await send_email(admin_email, f"Nuevo registro pendiente: {nuevo_usuario_rol}", html)
    except Exception as e:
        logger.error(f"Email send failed (send_admin_alert) for {nuevo_usuario_email}: {str(e)}")
