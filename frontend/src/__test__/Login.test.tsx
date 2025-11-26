import { render, screen, fireEvent, waitFor, act, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../pages/auth/Login";
import { apiRequest } from "../config/api";

jest.mock("../config/api");

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });


describe("Login Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.setItem.mockClear();
  });

  test("muestra inputs y permite escribir en ellos", async () => {
    render(<Login />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    await userEvent.type(emailInput, "test@mail.com");
    await userEvent.type(passwordInput, "123456");

    expect(emailInput).toHaveValue("test@mail.com");
    expect(passwordInput).toHaveValue("123456");
  });

  test("no envía el formulario cuando los campos están vacíos", async () => {
    render(<Login />);
    
    const submitButton = screen.getByRole("button", { name: /login/i });
    
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(apiRequest).not.toHaveBeenCalled();
    });
  });

  test("envía el formulario con datos correctos", async () => {
    const mockApiRequest = apiRequest as jest.Mock;
    mockApiRequest.mockResolvedValue({ token: "fake-token-123" });

    render(<Login />);
    
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "password123");

    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
            password: "password123",
          }),
        })
      );
    });
  });


  test("guarda el token en localStorage cuando el login es exitoso", async () => {
    const mockApiRequest = apiRequest as jest.Mock;
    mockApiRequest.mockResolvedValue({ token: "fake-token-123" });

    render(<Login />);
    
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "token",
        "fake-token-123"
      );
    });
  });


  test("muestra error cuando el login falla", async () => {
    const mockApiRequest = apiRequest as jest.Mock;
    const errorMessage = "Credenciales inválidas";
    mockApiRequest.mockRejectedValue(new Error(errorMessage));

    render(<Login />);
    
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "wrongpassword");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
  });

  test("no muestra error inicialmente", () => {
    render(<Login />);
    
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("limpia el error cuando el usuario comienza a escribir", async () => {
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });


  test("tiene un enlace a la página de registro", () => {
    render(<Login />);
    
    const registerLink = screen.getByRole("link", { name: /¿no tienes una cuenta\? regístrate/i });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register");
  });


  test("usa userEvent para simular interacción de usuario real", async () => {
    const user = userEvent.setup();
    render(<Login />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    // userEvent es más realista que fireEvent
    await user.type(emailInput, "user@example.com");
    await user.type(passwordInput, "mypassword");

    expect(emailInput).toHaveValue("user@example.com");
    expect(passwordInput).toHaveValue("mypassword");
  });
});