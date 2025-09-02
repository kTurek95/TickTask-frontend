import Form from "../components/Form";
import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="card p-4 main-container">
        <a className="text-center mb-3" href="https://inqse.com/" target="_blank">
          <img
            src="https://quguse.pl/img/INQSE_logo.png"
            alt="Logo INQSE"
            className="logo"
          />
        </a>
        <h3 className="text-center">🔐 Logowanie</h3>
        <Form route="/api/token/" method="login" />
        <p className="text-center mt-0 mb-0">
          Nie masz konta? <Link to="/register">Zarejestruj się</Link>
        </p>
      </div>
    </div>
  );
}
