import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamRosterEditor, { RosterTeam, RosterPlayer, TeamRosterEditorProps } from "../components/TeamRosterEditor";
import { apiRequest } from "../config/api";
import { renderWithTheme } from "../testUtils/renderWithTheme";

jest.mock("../config/api");

const mockApiRequest = apiRequest as jest.Mock;

// useMediaQuery (usado para fullScreen en mobile) explota sin ThemeProvider en
// el árbol: fuera de la app real siempre hay uno (App.tsx), así que acá se
// replica lo mínimo necesario.
const renderEditor = (props: TeamRosterEditorProps) => renderWithTheme(<TeamRosterEditor {...props} />);

const twoFullTeams: RosterTeam[] = [
  { teamId: "t1", name: "Equipo 1", players: [{ playerId: "p-ana", name: "Ana" }, { playerId: "p-beto", name: "Beto" }] },
  { teamId: "t2", name: "Equipo 2", players: [{ playerId: "p-cami", name: "Cami" }, { playerId: "p-dani", name: "Dani" }] }
];

const oneFreeSlot: RosterTeam[] = [
  { teamId: "t1", name: "Equipo 1", players: [{ playerId: "p-ana", name: "Ana" }, { playerId: "p-beto", name: "Beto" }] },
  { teamId: "t2", name: "Equipo 2", players: [{ playerId: "p-cami", name: "Cami" }] }
];

const noop = () => {};

describe("TeamRosterEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("tocar un jugador lo deja seleccionado", async () => {
    renderEditor({
      open: true,
      onClose: noop,
      tournamentId: "tour-1",
      mode: "random",
      teamSize: 2,
      teams: twoFullTeams,
      unassigned: [],
      hasDraft: true,
      onSaved: noop
    });

    await userEvent.click(screen.getByRole("button", { name: "Ana" }));

    expect(screen.getByText("Seleccionado: Ana")).toBeInTheDocument();
  });

  test("tocar dos veces al mismo jugador lo deselecciona", async () => {
    renderEditor({
      open: true,
      onClose: noop,
      tournamentId: "tour-1",
      mode: "random",
      teamSize: 2,
      teams: twoFullTeams,
      unassigned: [],
      hasDraft: true,
      onSaved: noop
    });

    const anaButton = screen.getByRole("button", { name: "Ana" });
    await userEvent.click(anaButton);
    expect(screen.getByText("Seleccionado: Ana")).toBeInTheDocument();

    await userEvent.click(anaButton);
    expect(screen.queryByText("Seleccionado: Ana")).not.toBeInTheDocument();
  });

  test("intercambia dos jugadores de distintos equipos", async () => {
    renderEditor({
      open: true,
      onClose: noop,
      tournamentId: "tour-1",
      mode: "random",
      teamSize: 2,
      teams: twoFullTeams,
      unassigned: [],
      hasDraft: true,
      onSaved: noop
    });

    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    await userEvent.click(screen.getByRole("button", { name: "Cami" }));

    const team1 = within(screen.getByTestId("roster-team-0"));
    const team2 = within(screen.getByTestId("roster-team-1"));

    expect(team1.getByText("Cami")).toBeInTheDocument();
    expect(team1.queryByText("Ana")).not.toBeInTheDocument();
    expect(team2.getByText("Ana")).toBeInTheDocument();
    expect(team2.queryByText("Cami")).not.toBeInTheDocument();

    // Guardar cambios se habilita porque hubo un cambio.
    expect(screen.getByRole("button", { name: "Guardar cambios" })).not.toBeDisabled();
  });

  test("mueve un jugador a un lugar libre de otro equipo", async () => {
    renderEditor({
      open: true,
      onClose: noop,
      tournamentId: "tour-1",
      mode: "random",
      teamSize: 2,
      teams: oneFreeSlot,
      unassigned: [],
      hasDraft: true,
      onSaved: noop
    });

    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    await userEvent.click(screen.getByText("Lugar libre"));

    const team1 = within(screen.getByTestId("roster-team-0"));
    const team2 = within(screen.getByTestId("roster-team-1"));

    expect(team1.queryByText("Ana")).not.toBeInTheDocument();
    expect(team2.getByText("Ana")).toBeInTheDocument();
    expect(team2.getByText("Cami")).toBeInTheDocument();
  });

  test("tocar un equipo completo (fuera de un jugador) no hace nada y avisa", async () => {
    renderEditor({
      open: true,
      onClose: noop,
      tournamentId: "tour-1",
      mode: "random",
      teamSize: 2,
      teams: twoFullTeams,
      unassigned: [],
      hasDraft: true,
      onSaved: noop
    });

    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    fireEvent.click(screen.getByTestId("roster-team-1"));

    expect(screen.getByText("Seleccionado: Ana")).toBeInTheDocument();
    expect(
      screen.getByText("Ese equipo está completo. Tocá un jugador para intercambiarlos.")
    ).toBeInTheDocument();
  });

  test("Guardar cambios llama a apiRequest con PUT y el body esperado", async () => {
    mockApiRequest.mockResolvedValue({ message: "ok", teams: [], draftInvalidated: false });
    const onSaved = jest.fn();

    renderEditor({
      open: true,
      onClose: noop,
      tournamentId: "tour-1",
      mode: "random",
      teamSize: 2,
      teams: twoFullTeams,
      unassigned: [],
      hasDraft: true,
      onSaved
    });

    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    await userEvent.click(screen.getByRole("button", { name: "Cami" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

    const [, options] = mockApiRequest.mock.calls[0];
    expect(options.method).toBe("PUT");
    const body = JSON.parse(options.body);
    expect(body.teams).toEqual([
      { teamId: "t1", players: [{ playerId: "p-cami", name: "Cami", isGuest: false }, { playerId: "p-beto", name: "Beto", isGuest: false }] },
      { teamId: "t2", players: [{ playerId: "p-ana", name: "Ana", isGuest: false }, { playerId: "p-dani", name: "Dani", isGuest: false }] }
    ]);

    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test("en modo user-formed no se renderiza el banco y se muestra el aviso", () => {
    const userFormedTeams: RosterTeam[] = [
      { teamId: "t1", name: "Equipo 1", registeredBy: "u1", players: [{ playerId: "p-ana", name: "Ana" }, { playerId: "p-beto", name: "Beto" }] },
      { teamId: "t2", name: "Equipo 2", players: [{ playerId: "p-cami", name: "Cami" }, { playerId: "p-dani", name: "Dani" }] }
    ];
    const unassigned: RosterPlayer[] = [];

    renderEditor({
      open: true,
      onClose: noop,
      tournamentId: "tour-1",
      mode: "user-formed",
      teamSize: 2,
      teams: userFormedTeams,
      unassigned,
      hasDraft: false,
      onSaved: noop
    });

    expect(screen.queryByTestId("roster-bench")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Estos equipos los inscribieron los propios jugadores/)
    ).toBeInTheDocument();
    expect(screen.getByText("Inscripto por un jugador")).toBeInTheDocument();
  });
});
