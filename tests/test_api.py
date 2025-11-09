"""Test API endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel
from app.main import app
from app.database import get_session
from app.models import Symbol, Strategy


# Test database
@pytest.fixture(name="session")
def session_fixture():
    """Create test database session."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """Create test client with test database."""

    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_health_check(client: TestClient) -> None:
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_symbol(client: TestClient, session: Session) -> None:
    """Test creating a new symbol."""
    response = client.post(
        "/symbols", json={"symbol": "AAPL", "name": "Apple Inc."}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["name"] == "Apple Inc."
    assert data["active"] is True


def test_list_symbols(client: TestClient, session: Session) -> None:
    """Test listing symbols."""
    # Create some symbols
    session.add(Symbol(symbol="AAPL", name="Apple"))
    session.add(Symbol(symbol="GOOGL", name="Google"))
    session.commit()

    response = client.get("/symbols")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert any(s["symbol"] == "AAPL" for s in data)


def test_delete_symbol(client: TestClient, session: Session) -> None:
    """Test deleting/deactivating a symbol."""
    session.add(Symbol(symbol="AAPL", name="Apple"))
    session.commit()

    response = client.delete("/symbols/AAPL")
    assert response.status_code == 200

    # Verify it's deactivated
    symbol = session.get(Symbol, "AAPL")
    assert symbol is not None
    assert symbol.active is False


def test_create_strategy(client: TestClient, session: Session) -> None:
    """Test creating a strategy."""
    response = client.post(
        "/strategies",
        json={
            "key": "test_strat",
            "name": "Test Strategy",
            "params_json": '{"param1": 10}',
            "enabled": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["key"] == "test_strat"
    assert data["enabled"] is True


def test_update_strategy(client: TestClient, session: Session) -> None:
    """Test updating a strategy."""
    # Create strategy
    session.add(
        Strategy(key="test_strat", name="Test", params_json="{}", enabled=True)
    )
    session.commit()

    # Update it
    response = client.patch(
        "/strategies/test_strat", json={"enabled": False}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is False


def test_list_signals(client: TestClient) -> None:
    """Test listing signals."""
    response = client.get("/signals")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_prices(client: TestClient, session: Session) -> None:
    """Test getting price data."""
    response = client.get("/prices/AAPL")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
