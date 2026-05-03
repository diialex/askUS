"""
Seed script — inserta 50 preguntas del pool en la BD.
Todas las preguntas son del tipo "¿Quién del grupo...?"

Uso (desde la raíz del backend):
    python scripts/seed_questions.py
    python scripts/seed_questions.py --dry-run   # solo muestra sin insertar
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime

# Asegura que el directorio raíz del proyecto esté en el path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import asyncpg

# ── Preguntas ─────────────────────────────────────────────────────────────────

QUESTIONS = [
    # amigos ──────────────────────────────────────────────────────────────────
    ("amigos", "¿Quién sería más probable que se comprase todo el merchandising de Shin Chan en Japón?"),
    ("amigos", "¿Quién llegaría tarde a su propia boda?"),
    ("amigos", "¿Quién sobreviviría más tiempo en una isla desierta?"),
    ("amigos", "¿Quién se gastaría el sueldo entero en un fin de semana?"),
    ("amigos", "¿Quién sería el primero en probar un restaurante rarísimo solo por el hype?"),
    ("amigos", "¿Quién montaría un negocio y lo abandonaría al mes?"),
    ("amigos", "¿Quién se haría amigo del vecino más gruñón del edificio?"),
    ("amigos", "¿Quién nunca se sabe cuándo está de broma y cuándo habla en serio?"),
    ("amigos", "¿Quién llevaría snacks de contrabando al cine?"),
    ("amigos", "¿Quién se iría de viaje sin planificar absolutamente nada?"),
    ("amigos", "¿Quién coleccionaría algo completamente absurdo, como tapones de corcho?"),
    ("amigos", "¿Quién haría un challenge viral de TikTok sin que nadie se lo pidiera?"),
    ("amigos", "¿Quién terminaría apareciendo en las noticias por algo ridículo pero inofensivo?"),
    ("amigos", "¿Quién conoce a alguien famoso y no lo ha mencionado hasta hoy?"),
    ("amigos", "¿Quién sería el primero en apuntarse a vivir en Marte?"),

    # trabajo ─────────────────────────────────────────────────────────────────
    ("trabajo", "¿Quién manda correos a las 3 de la mañana como si fuera lo más normal del mundo?"),
    ("trabajo", "¿Quién tiene la mesa más caótica de toda la oficina?"),
    ("trabajo", "¿Quién se apunta a todos los cursos opcionales sin acabar ninguno?"),
    ("trabajo", "¿Quién montaría una startup y conseguiría inversores en tiempo récord?"),
    ("trabajo", "¿Quién es el que siempre dice 'podría ser un email' en cada reunión?"),
    ("trabajo", "¿Quién tiene el historial de pestañas del navegador más caótico?"),
    ("trabajo", "¿Quién pediría vacaciones justo antes de una entrega importante?"),
    ("trabajo", "¿Quién acabaría siendo el jefe en 5 años?"),
    ("trabajo", "¿Quién trae la comida que huele más raro para calentar en el microondas?"),
    ("trabajo", "¿Quién convencería a todo el equipo para trabajar desde Bali un mes?"),

    # pareja ──────────────────────────────────────────────────────────────────
    ("pareja", "¿Quién ligaría con alguien solo porque tiene perro?"),
    ("pareja", "¿Quién declararía su amor en un estadio de fútbol con una pancarta?"),
    ("pareja", "¿Quién mantendría en secreto una relación durante meses sin que nadie se enterase?"),
    ("pareja", "¿Quién se enamoraría del protagonista de una serie y lo negaría todo?"),
    ("pareja", "¿Quién organizaría el plan de cita más original que nadie haya visto?"),
    ("pareja", "¿Quién terminaría casándose con alguien que conoció en internet?"),
    ("pareja", "¿Quién seguiría a su ex en redes con cuenta falsa?"),
    ("pareja", "¿Quién escribiría una canción de amor y la subiría a Spotify?"),
    ("pareja", "¿Quién pediría matrimonio en el primer aniversario?"),
    ("pareja", "¿Quién adoptaría 4 gatos para no sentirse solo?"),

    # familia ─────────────────────────────────────────────────────────────────
    ("familia", "¿Quién es el favorito de la abuela?"),
    ("familia", "¿Quién siempre llega tarde a la cena de Navidad?"),
    ("familia", "¿Quién contaría el chisme familiar antes de que todo el mundo lo sepa?"),
    ("familia", "¿Quién discutiría con el tío en la comida del domingo?"),
    ("familia", "¿Quién se quedaría a vivir en casa de los padres más tiempo del planeado?"),
    ("familia", "¿Quién haría el regalo más inesperado en Reyes?"),
    ("familia", "¿Quién llamaría a la madre cada día aunque viva a 2 kilómetros?"),
    ("familia", "¿Quién organizaría la reunión familiar y terminaría arrepintiéndose?"),

    # general ─────────────────────────────────────────────────────────────────
    ("general", "¿Quién respondería primero a un mensaje de grupo a las 4 de la mañana?"),
    ("general", "¿Quién se haría famoso en internet sin quererlo?"),
    ("general", "¿Quién cambiaría completamente de personalidad al hablar en otro idioma?"),
    ("general", "¿Quién tiene más series en 'pendientes' que horas de vida para verlas?"),
    ("general", "¿Quién organizaría el mejor plan del año con solo 10 euros?"),
    ("general", "¿Quién acabaría ganando un talent show?"),
    ("general", "¿Quién podría vivir sin internet durante un mes y salir más feliz?"),
]

# ── Inserción ─────────────────────────────────────────────────────────────────

async def seed(dry_run: bool = False) -> None:
    db_user     = os.getenv("DB_USER", "askus")
    db_password = os.getenv("DB_PASSWORD", "")
    db_host     = os.getenv("DB_HOST", "localhost")
    db_port     = int(os.getenv("DB_PORT", "5432"))
    db_name     = os.getenv("DB_NAME", "askus")

    dsn = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    print(f"{'[DRY RUN] ' if dry_run else ''}Conectando a {db_host}:{db_port}/{db_name}...")

    if dry_run:
        print(f"\n{len(QUESTIONS)} preguntas a insertar:\n")
        for i, (cat, text) in enumerate(QUESTIONS, 1):
            print(f"  [{i:02d}] ({cat}) {text}")
        return

    conn = await asyncpg.connect(dsn)
    try:
        now = datetime.utcnow()
        rows = [
            (str(uuid4()), category, text, True, now)
            for category, text in QUESTIONS
        ]

        inserted = await conn.executemany(
            """
            INSERT INTO questions (uuid, category, text, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
            """,
            rows,
        )

        print(f"\n✅ {len(QUESTIONS)} preguntas insertadas correctamente.\n")

        # Resumen por categoría
        counts = {}
        for cat, _ in QUESTIONS:
            counts[cat] = counts.get(cat, 0) + 1
        for cat, n in sorted(counts.items()):
            print(f"   {cat:10s} → {n} preguntas")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed questions into the pool")
    parser.add_argument("--dry-run", action="store_true", help="Solo muestra las preguntas sin insertar")
    args = parser.parse_args()

    asyncio.run(seed(dry_run=args.dry_run))
