"""
Scheduler de tareas periódicas.

Tarea principal:
  Cada día a las 14:00 (hora de Madrid) recorre todos los grupos activos,
  cierra la pregunta que estuviera abierta y asigna una nueva aleatoria
  del pool global.
"""

import logging
import random
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.db.database import AsyncSessionFactory
from app.models.group import Group, GroupMember
from app.models.question import GroupQuestion, Question

logger = logging.getLogger(__name__)

# ── Scheduler singleton ───────────────────────────────────────────────────────

scheduler = AsyncIOScheduler(timezone="Europe/Madrid")


# ── Lógica del job ────────────────────────────────────────────────────────────

async def send_daily_questions() -> None:
    """
    Envía una pregunta aleatoria del pool a cada grupo activo.
    Se ejecuta todos los días a las 14:00 hora de Madrid.
    """
    logger.info("[Scheduler] Iniciando envío diario de preguntas — %s", datetime.now().isoformat())

    async with AsyncSessionFactory() as session:
        try:
            # 1. Obtener todos los grupos activos
            groups_result = await session.execute(
                select(Group).where(Group.is_active == True)
            )
            groups = groups_result.scalars().all()

            if not groups:
                logger.info("[Scheduler] No hay grupos activos.")
                return

            # 2. Obtener todas las preguntas activas del pool
            pool_result = await session.execute(
                select(Question).where(Question.is_active == True)
            )
            pool = pool_result.scalars().all()

            if not pool:
                logger.warning("[Scheduler] El pool de preguntas está vacío. No se envía nada.")
                return

            sent = 0
            for group in groups:
                # 3. Cerrar la pregunta activa del grupo (si existe)
                active_result = await session.execute(
                    select(GroupQuestion).where(
                        GroupQuestion.group_uuid == group.uuid,
                        GroupQuestion.status == "active",
                    )
                )
                for old_gq in active_result.scalars().all():
                    old_gq.status = "closed"
                    old_gq.closed_at = datetime.utcnow()

                # 4. Elegir pregunta aleatoria del pool
                question = random.choice(pool)

                # 5. Crear la nueva GroupQuestion
                gq = GroupQuestion(
                    question_uuid=str(question.uuid),
                    group_uuid=str(group.uuid),
                    status="active",
                )
                session.add(gq)
                sent += 1

            await session.commit()
            logger.info("[Scheduler] ✅ Preguntas enviadas a %d grupos.", sent)

        except Exception as exc:
            await session.rollback()
            logger.error("[Scheduler] ❌ Error en el envío diario: %s", exc, exc_info=True)


# ── Registro del job ──────────────────────────────────────────────────────────

def setup_scheduler() -> None:
    """Registra los jobs y arranca el scheduler. Llamar desde el lifespan."""
    scheduler.add_job(
        send_daily_questions,
        trigger=CronTrigger(hour=14, minute=0, timezone="Europe/Madrid"),
        id="daily_questions",
        name="Envío diario de preguntas a grupos",
        replace_existing=True,
        misfire_grace_time=60 * 10,   # tolera hasta 10 min de retraso
    )
    scheduler.start()
    next_run = scheduler.get_job("daily_questions").next_run_time
    logger.info("[Scheduler] Iniciado — próxima ejecución: %s", next_run)
    print(f"[Scheduler] ✅ Iniciado — próxima pregunta diaria: {next_run}")


def shutdown_scheduler() -> None:
    """Para el scheduler limpiamente. Llamar desde el lifespan shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Detenido.")
