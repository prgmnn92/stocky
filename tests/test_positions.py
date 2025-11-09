"""Test position management endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel
from app.main import app
from app.database import get_session


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


def test_create_position(client: TestClient) -> None:
    """Test creating a new position."""
    response = client.post(
        "/positions",
        json={
            "symbol": "AAPL",
            "qty": 10,
            "price": 185.50,
            "meta_json": '{"strategy": "sma_cross"}',
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["qty"] == 10
    assert data["avg_price"] == 185.50
    assert data["status"] == "OPEN"
    assert data["pnl"] is None
    assert data["closed_at"] is None


def test_list_positions(client: TestClient) -> None:
    """Test listing positions."""
    # Create some positions
    client.post("/positions", json={"symbol": "AAPL", "qty": 10, "price": 185.50})
    client.post("/positions", json={"symbol": "MSFT", "qty": 5, "price": 350.00})

    response = client.get("/positions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_list_positions_with_status_filter(client: TestClient) -> None:
    """Test filtering positions by status."""
    # Create and close one position
    response = client.post("/positions", json={"symbol": "AAPL", "qty": 10, "price": 185.50})
    position_id = response.json()["id"]
    client.post(f"/positions/{position_id}/close", json={"price": 190.00})

    # Create another open position
    client.post("/positions", json={"symbol": "MSFT", "qty": 5, "price": 350.00})

    # Filter by OPEN
    response = client.get("/positions?status=OPEN")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "MSFT"

    # Filter by CLOSED
    response = client.get("/positions?status=CLOSED")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "AAPL"


def test_close_position(client: TestClient) -> None:
    """Test closing a position and P&L calculation."""
    # Create position
    response = client.post("/positions", json={"symbol": "AAPL", "qty": 10, "price": 185.50})
    position_id = response.json()["id"]

    # Close position
    response = client.post(f"/positions/{position_id}/close", json={"price": 190.00})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "CLOSED"
    assert data["closed_at"] is not None
    # P&L = (190.00 - 185.50) * 10 = 45.00
    assert data["pnl"] == 45.00


def test_close_position_with_loss(client: TestClient) -> None:
    """Test closing a position at a loss."""
    # Create position
    response = client.post("/positions", json={"symbol": "AAPL", "qty": 10, "price": 185.50})
    position_id = response.json()["id"]

    # Close at lower price
    response = client.post(f"/positions/{position_id}/close", json={"price": 180.00})
    assert response.status_code == 200
    data = response.json()
    # P&L = (180.00 - 185.50) * 10 = -55.00
    assert data["pnl"] == -55.00


def test_close_nonexistent_position(client: TestClient) -> None:
    """Test closing a position that doesn't exist."""
    response = client.post("/positions/9999/close", json={"price": 190.00})
    assert response.status_code == 404


def test_close_already_closed_position(client: TestClient) -> None:
    """Test closing a position that's already closed."""
    # Create and close position
    response = client.post("/positions", json={"symbol": "AAPL", "qty": 10, "price": 185.50})
    position_id = response.json()["id"]
    client.post(f"/positions/{position_id}/close", json={"price": 190.00})

    # Try to close again
    response = client.post(f"/positions/{position_id}/close", json={"price": 195.00})
    assert response.status_code == 400
    assert "not open" in response.json()["detail"].lower()


def test_get_position_executions(client: TestClient) -> None:
    """Test getting executions for a position."""
    # Create position
    response = client.post("/positions", json={"symbol": "AAPL", "qty": 10, "price": 185.50})
    position_id = response.json()["id"]

    # Get executions (should have 1 BUY)
    response = client.get(f"/positions/{position_id}/executions")
    assert response.status_code == 200
    executions = response.json()
    assert len(executions) == 1
    assert executions[0]["side"] == "BUY"
    assert executions[0]["qty"] == 10
    assert executions[0]["price"] == 185.50

    # Close position
    client.post(f"/positions/{position_id}/close", json={"price": 190.00})

    # Get executions (should have 2: BUY and SELL)
    response = client.get(f"/positions/{position_id}/executions")
    assert response.status_code == 200
    executions = response.json()
    assert len(executions) == 2
    assert executions[0]["side"] == "BUY"
    assert executions[1]["side"] == "SELL"
    assert executions[1]["price"] == 190.00


def test_create_position_validation(client: TestClient) -> None:
    """Test position creation validation."""
    # Negative quantity
    response = client.post("/positions", json={"symbol": "AAPL", "qty": -10, "price": 185.50})
    assert response.status_code == 422

    # Zero quantity
    response = client.post("/positions", json={"symbol": "AAPL", "qty": 0, "price": 185.50})
    assert response.status_code == 422

    # Negative price
    response = client.post("/positions", json={"symbol": "AAPL", "qty": 10, "price": -185.50})
    assert response.status_code == 422

    # Zero price
    response = client.post("/positions", json={"symbol": "AAPL", "qty": 10, "price": 0})
    assert response.status_code == 422
