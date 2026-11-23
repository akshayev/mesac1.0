/**
 * Programs and labs shown on /mechanical-dept.
 *
 * The faculty list and Head-of-Division card were removed because the names could not be
 * verified. To bring them back, confirm the names with the department office and add them to
 * the team Sheet with group = "Faculty" (they then appear on /team). The old data is in git
 * history: `git log --diff-filter=M -- src/data/department.ts`, look for the commit titled
 * "remove unverified faculty data".
 */
import type { DepartmentProgram, Lab, DepartmentOverview } from "@/types";

export const departmentOverview: DepartmentOverview = {
  name: "Division of Mechanical Engineering",
  establishedYear: 1995,
  school: "School of Engineering",
  university: "Cochin University of Science and Technology (CUSAT)",
  summary:
    "The Mechanical Engineering Division established in 1995 is the largest division of the School of Engineering in terms of faculty size and laboratory infrastructure. The curriculum is continuously reviewed to adapt to evolving technological demands and to satisfy the needs of both national and international industry, integrating modern advances in electronics, computation, and automation into core mechanical systems.",
  mission: [
    "Imparting quality education to students and enhancing their skills to make them globally competitive mechanical engineers.",
    "Maintaining vital, state-of-the-art research facilities to provide students and faculty with opportunities to create, interpret, apply, and disseminate knowledge.",
    "Developing linkages with world-class R&D organizations and educational institutions in India and abroad for excellence in teaching, research, and consultancy practices.",
  ],
  vision:
    "The Mechanical Engineering Division strives to be recognized globally for outstanding education and research, developing well-qualified engineers who are innovative, entrepreneurial, and successful in advanced fields of engineering and technology.",
};

export const departmentPrograms: DepartmentProgram[] = [
  {
    id: "prog-btech",
    name: "B.Tech in Mechanical Engineering",
    degree: "B.Tech",
    duration: "4 Years (8 Semesters)",
    intake: "90 Seats",
    description:
      "Comprehensive undergraduate engineering program covering solid mechanics, thermodynamics, fluid machinery, CAD/CAM, and manufacturing technology.",
  },
  {
    id: "prog-mtech-thermal",
    name: "M.Tech in Thermal Engineering",
    degree: "M.Tech",
    duration: "2 Years (4 Semesters)",
    intake: "18 Seats",
    description:
      "Postgraduate program in thermal sciences, computational fluid dynamics (CFD), cryogenic engineering, heat exchanger design, and energy systems.",
  },
  {
    id: "prog-mtech-iem",
    name: "M.Tech in Industrial Engineering & Management",
    degree: "M.Tech",
    duration: "2 Years (4 Semesters)",
    intake: "18 Seats",
    description:
      "Postgraduate specialization in supply chain engineering, operations research, total quality management, ergonomics, and production systems.",
  },
  {
    id: "prog-phd",
    name: "Ph.D. Doctoral Research Program",
    degree: "Ph.D.",
    duration: "3 - 5 Years",
    intake: "Research Fellowships",
    description:
      "Doctoral research in composite materials, microfluidics, tribology, thermal sciences, robotic kinematics, and advanced mechanical modeling.",
  },
];

export const departmentLabs: Lab[] = [
  {
    id: "lab-thermal",
    name: "Thermal Engineering & IC Engines Laboratory",
    description:
      "Experimental facility for testing internal combustion engines, fuel properties, and heat transfer characteristics.",
  },
  {
    id: "lab-fluid",
    name: "Fluid Mechanics & Hydraulics Laboratory",
    description:
      "Hydrodynamic test facility for open-channel flow, pipe flow, and impulse and reaction hydraulic turbines.",
  },
  {
    id: "lab-cadcam",
    name: "CAD / CAM & Robotics Center",
    description:
      "Computational facility for computer-aided design, geometric modeling, finite element analysis, and CNC machining.",
  },
  {
    id: "lab-metallurgy",
    name: "Metallurgy & Material Testing Laboratory",
    description:
      "Material testing facility for mechanical property evaluation of metals, polymers, and engineering specimens.",
  },
  {
    id: "lab-manufacturing",
    name: "Advanced Manufacturing & Machine Shop",
    description:
      "Machine shop facility equipped with conventional and specialized machine tools for engineering practice.",
  },
  {
    id: "lab-mechatronics",
    name: "Mechatronics & Instrumentation Laboratory",
    description:
      "Laboratory for sensors, instrumentation, pneumatic and hydraulic circuits, and microcontroller-based automation.",
  },
];
