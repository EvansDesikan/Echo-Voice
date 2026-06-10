"""
Backend Engineer — Email Service
Sends transactional emails via Resend: OTP verification + family access code delivery.
Bilingual: sends in client's language (de/en).
"""
import resend
from loguru import logger
from config.settings import settings


def _init_resend():
    resend.api_key = settings.RESEND_API_KEY


# ─── OTP email ────────────────────────────────────────────────────────────────

_OTP_SUBJECT = {
    "de": "Ihr ECHO Voice Bestätigungscode",
    "en": "Your ECHO Voice verification code",
}

_OTP_HTML = {
    "de": """
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#15779b,#0f5a7a);padding:32px 40px;text-align:center">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px">ECHO Voice</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">E-Mail-Bestätigung</p>
        </td></tr>
        <tr><td style="padding:40px">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px">Hallo,<br><br>Ihr Bestätigungscode für ECHO Voice lautet:</p>
          <div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:10px;padding:28px;text-align:center;margin:0 0 28px">
            <span style="font-family:monospace;font-size:42px;font-weight:700;letter-spacing:0.25em;color:#0f5a7a">{code}</span>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 8px">Dieser Code ist <strong>15 Minuten</strong> gültig und kann nur einmal verwendet werden.</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0">Falls Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px;margin:0">ECHO Voice &mdash; Ein würdevoller Abschied, der bleibt.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""",
    "en": """
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#15779b,#0f5a7a);padding:32px 40px;text-align:center">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px">ECHO Voice</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Email verification</p>
        </td></tr>
        <tr><td style="padding:40px">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px">Hello,<br><br>Your verification code for ECHO Voice is:</p>
          <div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:10px;padding:28px;text-align:center;margin:0 0 28px">
            <span style="font-family:monospace;font-size:42px;font-weight:700;letter-spacing:0.25em;color:#0f5a7a">{code}</span>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 8px">This code is valid for <strong>15 minutes</strong> and can only be used once.</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0">If you did not request this email, you can safely ignore it.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px;margin:0">ECHO Voice &mdash; A dignified farewell that endures.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""",
}


async def send_otp_email(email: str, code: str, language: str = "de") -> bool:
    """Send a 6-digit OTP to the given address. Returns True on success."""
    lang = language if language in ("de", "en") else "de"
    _init_resend()
    try:
        resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [email],
            "subject": _OTP_SUBJECT[lang],
            "html": _OTP_HTML[lang].format(code=code),
        })
        logger.info(f"OTP email sent to {email} (lang={lang})")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {e}")
        return False


# ─── Access code email ────────────────────────────────────────────────────────

_ACCESS_SUBJECT = {
    "de": "ECHO Voice ist bereit — Zugangscode für Ihre Familie",
    "en": "ECHO Voice is ready — Access code for your family",
}

_ACCESS_HTML = {
    "de": """
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#15779b,#0f5a7a);padding:32px 40px;text-align:center">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px">ECHO Voice</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Ihr Profil ist vollständig</p>
        </td></tr>
        <tr><td style="padding:40px">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px">Liebe(r) <strong>{name}</strong>,</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 28px">Ihr ECHO Voice Profil ist jetzt vollständig. Das ist ein außergewöhnliches Geschenk an Ihre Familie — ein Teil von Ihnen, der bleibt.</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px"><strong>Ihr Familien-Zugangscode:</strong></p>
          <div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:10px;padding:24px;text-align:center;margin:0 0 28px">
            <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:0.2em;color:#0f5a7a">{code}</span>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 8px">Teilen Sie diesen Code mit Ihren Liebsten. Sie können damit jederzeit eine Konversation mit Ihrem ECHO Voice Gedenkprofil starten — ganz ohne E-Mail-Adresse.</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 28px">So funktioniert es:</p>
          <ol style="color:#6b7280;font-size:14px;line-height:1.9;margin:0 0 28px;padding-left:20px">
            <li>Familie besucht <strong>echo-voice-liard.vercel.app</strong></li>
            <li>Klickt auf „Als Familie verbinden"</li>
            <li>Gibt den obigen Code ein</li>
            <li>Startet das Gespräch</li>
          </ol>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0">Bewahren Sie diesen Code sicher auf. Sie können ihn jederzeit in Ihrem Profil erneut abrufen.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px;margin:0">ECHO Voice &mdash; Ein würdevoller Abschied, der bleibt.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""",
    "en": """
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#15779b,#0f5a7a);padding:32px 40px;text-align:center">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px">ECHO Voice</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Your profile is complete</p>
        </td></tr>
        <tr><td style="padding:40px">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px">Dear <strong>{name}</strong>,</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 28px">Your ECHO Voice profile is now complete. This is an extraordinary gift to your family — a part of you that endures.</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px"><strong>Your family access code:</strong></p>
          <div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:10px;padding:24px;text-align:center;margin:0 0 28px">
            <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:0.2em;color:#0f5a7a">{code}</span>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 8px">Share this code with your loved ones. They can use it to start a conversation with your ECHO Voice memorial at any time — no email address needed.</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 28px">Here's how it works:</p>
          <ol style="color:#6b7280;font-size:14px;line-height:1.9;margin:0 0 28px;padding-left:20px">
            <li>Family visits <strong>echo-voice-liard.vercel.app</strong></li>
            <li>Clicks "Connect as family"</li>
            <li>Enters the code above</li>
            <li>Starts the conversation</li>
          </ol>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0">Keep this code safe. You can always retrieve it again from your profile.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px;margin:0">ECHO Voice &mdash; A dignified farewell that endures.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""",
}


async def send_access_code_email(email: str, name: str, access_code: str, language: str = "de") -> bool:
    """Send the formatted family access code to the client. Returns True on success."""
    lang = language if language in ("de", "en") else "de"
    # Format as XXXX-XXXX
    display_code = f"{access_code[:4]}-{access_code[4:]}" if len(access_code) == 8 else access_code
    _init_resend()
    try:
        resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [email],
            "subject": _ACCESS_SUBJECT[lang],
            "html": _ACCESS_HTML[lang].format(name=name, code=display_code),
        })
        logger.info(f"Access code email sent to {email} ({name}, lang={lang})")
        return True
    except Exception as e:
        logger.error(f"Failed to send access code email to {email}: {e}")
        return False
