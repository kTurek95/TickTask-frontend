import Form from "../components/Form";
import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="card p-4 shadow" style={{ width: "350px" }}>
        <h2 className="text-center mb-4">🔐 Logowanie</h2>
        <Form route="/api/token/" method="login" />
        <p className="text-center mt-3 mb-0">
          Nie masz konta? <Link to="/register">Zarejestruj się</Link>
        </p>
      </div>
    </div>
  );
}
