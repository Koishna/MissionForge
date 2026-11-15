import { state, setState } from "../state.js";

export const ROLES = {
  all: {
    label: "Everyone (solo)",

    controls: [
      "bus",
      "power",
      "battery",
      "comms",
      "computer",
      "pointing",
      "propulsion",
      "instruments",
      "orbit",
      "launcher",
    ],
  },

  lead: {
    label: "Mission Lead",

    controls: ["launcher"],
  },

  engineer: {
    label: "Spacecraft Engineer",

    controls: ["bus", "power", "battery", "computer", "pointing", "propulsion"],
  },

  science: {
    label: "Science Lead",

    controls: ["instruments"],
  },

  comms: {
    label: "Comms and Operations",

    controls: ["comms", "orbit"],
  },
};

export function rolePicker(container, onChange = null) {
  container.innerHTML = `

    <label class="role-picker">

      <span>
        ROLE
      </span>

      <select id="role">

        ${Object.entries(ROLES)
          .map(
            ([key, role]) => `

              <option
                value="${key}"
                ${state.role === key ? "selected" : ""}
              >
                ${role.label}
              </option>

            `,
          )
          .join("")}

      </select>

    </label>

  `;

  const select = container.querySelector("#role");

  select.addEventListener("change", (event) => {
    const newRole = event.target.value;

    setState({
      role: newRole,
    });

    if (typeof onChange === "function") {
      onChange(newRole);
    }
  });
}
