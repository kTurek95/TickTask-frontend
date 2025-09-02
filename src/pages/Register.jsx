import Form from "../components/Form";
import { Link } from "react-router-dom";

export default function Register() {
  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="card p-4 shadow" style={{ width: "350px" }}>
        <a className="text-center mb-3" href="https://inqse.com/" target="_blank">
          <img
            src="https://quguse.pl/img/INQSE_logo.png"
            alt="Logo INQSE"
            className="logo"
          />
        </a>
        <h2 className="text-center">📝 Rejestracja</h2>
        <Form route="/api/user/register/" method="register" />
        <p className="text-center mt-3 mb-0">
          Masz już konto? <Link to="/login">Zaloguj się</Link>
        </p>
      </div>
    </div>
  );
}
