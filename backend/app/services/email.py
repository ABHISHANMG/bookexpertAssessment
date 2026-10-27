"""Pluggable email service.

Two backends are supported, selected by ``settings.EMAIL_BACKEND``:

* ``console`` (default) — renders the message to the application log and appends
  it to ``logs/sent_emails.log``. Lets the whole approval flow be demoed with no
  mail server.
* ``smtp`` — really sends via an SMTP server using aiosmtplib.

Sending is done through FastAPI ``BackgroundTasks`` so the request is never
blocked by mail delivery, and a failed send never breaks the business action.
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
from pathlib import Path

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger("sims.email")

_LOG_DIR = Path("logs")
_LOG_FILE = _LOG_DIR / "sent_emails.log"


async def send_email(to: str | list[str], subject: str, body: str) -> None:
    recipients = [to] if isinstance(to, str) else to
    recipients = [r for r in recipients if r]
    if not recipients:
        logger.warning("send_email called with no recipients; skipping")
        return

    if settings.EMAIL_BACKEND == "smtp":
        await _send_smtp(recipients, subject, body)
    else:
        _send_console(recipients, subject, body)


def _send_console(recipients: list[str], subject: str, body: str) -> None:
    rendered = (
        "\n===== EMAIL (console backend) =====\n"
        f"From: {settings.EMAIL_FROM}\n"
        f"To: {', '.join(recipients)}\n"
        f"Subject: {subject}\n"
        f"\n{body}\n"
        "===================================\n"
    )
    logger.info(rendered)
    try:
        _LOG_DIR.mkdir(exist_ok=True)
        with _LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(rendered)
    except OSError as exc:  # logging must never crash the caller
        logger.warning("Could not persist email to log file: %s", exc)


async def _send_smtp(recipients: list[str], subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            start_tls=settings.SMTP_USE_TLS,
        )
        logger.info("Sent email to %s (subject=%r)", recipients, subject)
    except Exception as exc:  # noqa: BLE001 - never let email break the request
        logger.error("Failed to send email to %s: %s", recipients, exc)
