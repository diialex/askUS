"""
FastAPI application entry point.
Initializes the app with health check endpoint.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.scheduler import setup_scheduler, shutdown_scheduler
from app.routers import auth as auth_router
from app.routers import groups as groups_router
from app.routers import questions as questions_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan event handler.
    Handles startup and shutdown events.
    """
    # Startup
    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    setup_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()
    print("Shutting down application...")


# Initialize FastAPI app
app: FastAPI = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="askUS Backend API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Add CORS middleware
_ALLOWED_ORIGINS = [
    "https://api.monotocolor.com",
    "http://localhost:8081",   # Expo web dev
    "http://localhost:19006",  # Expo web alternativo
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(groups_router.router, prefix="/api/v1")
app.include_router(questions_router.router, prefix="/api/v1")


@app.get(
    path="/health",
    name="health_check",
    description="Health check endpoint to verify API is running",
    summary="API Health Check",
    response_model=dict,
    responses={
        200: {
            "description": "API is healthy",
            "content": {
                "application/json": {
                    "example": {
                        "status": "healthy",
                        "app_name": "askUS API",
                        "version": "1.0.0",
                    }
                }
            },
        },
    },
)
async def health_check() -> JSONResponse:
    """
    Health check endpoint.
    Returns the current status of the API.

    Returns:
        JSONResponse: Health status with app info.
    """
    return JSONResponse(
        content={
            "status": "healthy",
            "app_name": settings.APP_NAME,
            "version": settings.APP_VERSION,
        },
        status_code=200,
    )


@app.get(
    path="/",
    name="root",
    description="Root endpoint",
    summary="Root",
)
async def root() -> JSONResponse:
    """
    Root endpoint.
    Returns welcome message.

    Returns:
        JSONResponse: Welcome message.
    """
    return JSONResponse(
        content={
            "message": f"Welcome to {settings.APP_NAME}",
            "docs": "/docs",
        },
        status_code=200,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app="app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
