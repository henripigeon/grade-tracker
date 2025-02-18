import React, { useState, useEffect, FormEvent } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// Register required ChartJS components.
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ----- Type Definitions -----
interface Assignment {
  name: string;
  grade: number | null; // null means not yet graded
  weight: number;       // weight percentage for this assignment
}

interface CourseEntry {
  id?: string; // Firestore document ID
  course: string;
  year: string;
  semester: string;
  goalGrade: string;
  entryType: "final" | "scale";
  finalGrade?: string;
  assignments?: Assignment[];
  credits?: number; // each course is 3 credits
}

// ----- Mapping & Helper Functions -----
const letterToNumeric: { [key: string]: number } = {
  "A+": 10,
  A: 9,
  "A-": 8,
  "B+": 7,
  B: 6,
  "C+": 5,
  C: 4,
  "D+": 3,
  D: 2,
  E: 1,
  F: 0,
  ABS: 0,
  EIN: 0,
};

function percentageToLetter(percentage: number): string {
  if (percentage >= 90) return "A+";
  else if (percentage >= 85) return "A";
  else if (percentage >= 80) return "A-";
  else if (percentage >= 75) return "B+";
  else if (percentage >= 70) return "B";
  else if (percentage >= 65) return "C+";
  else if (percentage >= 60) return "C";
  else if (percentage >= 55) return "D+";
  else if (percentage >= 50) return "D";
  else if (percentage >= 40) return "E";
  else return "F";
}

// ----- Firebase Helper Functions -----
// Save a new course entry to Firestore.
async function saveCourse(courseEntry: CourseEntry): Promise<string | undefined> {
  try {
    const docRef = await addDoc(collection(db, "courses"), courseEntry);
    console.log("Course saved with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving course:", error);
  }
  return undefined;
}

// Update an existing course entry in Firestore.
async function updateCourseEntry(docId: string, courseEntry: CourseEntry) {
  try {
    const docRef = doc(db, "courses", docId);
    await updateDoc(docRef, courseEntry);
    console.log("Course updated with ID:", docId);
  } catch (error) {
    console.error("Error updating course:", error);
  }
}

// Delete a course entry from Firestore.
async function deleteCourseEntry(id: string) {
  try {
    const docRef = doc(db, "courses", id);
    await deleteDoc(docRef);
    console.log("Course deleted with ID:", id);
  } catch (error) {
    console.error("Error deleting course:", error);
  }
}

// Load all course entries from Firestore.
async function loadCourses(): Promise<CourseEntry[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "courses"));
    const courses: CourseEntry[] = [];
    querySnapshot.forEach((docSnap) => {
      courses.push({ id: docSnap.id, ...(docSnap.data() as CourseEntry) });
    });
    return courses;
  } catch (error) {
    console.error("Error loading courses:", error);
    return [];
  }
}

// ----- Main Component -----
const App: React.FC = () => {
  // Landing Dashboard State
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [totalCgpaVisible, setTotalCgpaVisible] = useState<boolean>(true);

  // Course Progress Data State
  const [progressData, setProgressData] = useState<CourseEntry[]>([]);

  // Form State
  const [course, setCourse] = useState<string>("");
  const [formYear, setFormYear] = useState<string>("");
  const [formSemester, setFormSemester] = useState<string>("");
  const [goalGrade, setGoalGrade] = useState<string>("");
  const [entryType, setEntryType] = useState<"final" | "scale">("final");
  const [finalGrade, setFinalGrade] = useState<string>("");

  // For grading scale entries – each assignment gets its own weight.
  const [currentAssignmentWeight, setCurrentAssignmentWeight] = useState<number>(0);
  const [assignmentName, setAssignmentName] = useState<string>("");
  const [assignmentGrade, setAssignmentGrade] = useState<string>(""); // empty string allowed
  const [currentAssignments, setCurrentAssignments] = useState<Assignment[]>([]);

  // Editing State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);

  // View Mode: "thisSemester" vs. "allCourses"
  const [viewMode, setViewMode] = useState<"thisSemester" | "allCourses">("thisSemester");

  // Load data from Firestore on mount
  useEffect(() => {
    (async () => {
      const courses = await loadCourses();
      setProgressData(courses);
    })();
  }, []);

  // ----- CGPA Calculations -----
  function computeEntryNumeric(entry: CourseEntry): number {
    if (entry.entryType === "final") {
      return letterToNumeric[entry.finalGrade || "F"] ?? 0;
    } else {
      const assignments = entry.assignments || [];
      const totalWeight = assignments.reduce((sum, a) => sum + a.weight, 0);
      const weightedSum = assignments.reduce(
        (sum, a) => sum + ((a.grade ?? 0) * a.weight),
        0
      );
      const avgPercentage = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const computedLetter = percentageToLetter(avgPercentage);
      return letterToNumeric[computedLetter] ?? 0;
    }
  }

  function computeAverageCGPA(entries: CourseEntry[]): string {
    if (entries.length === 0) return "N/A";
    let totalWeighted = 0;
    let totalCredits = 0;
    entries.forEach((entry) => {
      const credits = entry.credits || 3;
      totalWeighted += computeEntryNumeric(entry) * credits;
      totalCredits += credits;
    });
    return (totalWeighted / totalCredits).toFixed(2);
  }

  const totalCgpa = computeAverageCGPA(progressData);

  // Filter for selected year & semester (for table display)
  const filteredEntries =
    selectedYear && selectedSemester
      ? progressData.filter(
          (e) => e.year === selectedYear && e.semester === selectedSemester
        )
      : [];
  const termCgpa = computeAverageCGPA(filteredEntries);
  const entriesToShow = viewMode === "thisSemester" ? filteredEntries : progressData;

  // ----- Landing Handlers -----
  function handleYearSelect(year: string) {
    setSelectedYear(year);
    setSelectedSemester("");
  }

  function handleSemesterSelect(semester: string) {
    if (!selectedYear) return;
    setSelectedSemester(semester);
    setFormYear(selectedYear);
    setFormSemester(semester);
  }

  function toggleTotalCgpa() {
    setTotalCgpaVisible((prev) => !prev);
  }

  // ----- Assignment Handlers -----
  function handleAddAssignment() {
    const weight = currentAssignmentWeight;
    const gradeNum =
      assignmentGrade.trim() === "" ? null : parseFloat(assignmentGrade);

    if (assignmentName.trim() === "" || weight <= 0) {
      alert("Please enter a valid assignment name and weight.");
      return;
    }
    setCurrentAssignments((prev) => [
      ...prev,
      { name: assignmentName, grade: gradeNum, weight },
    ]);
    setAssignmentName("");
    setAssignmentGrade("");
    setCurrentAssignmentWeight(0);
  }

  function handleRemoveAssignment(index: number) {
    setCurrentAssignments((prev) => prev.filter((_, i) => i !== index));
  }

  // ----- Form Submission (Add / Edit) -----
  async function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formYear || !formSemester) {
      alert("Please select a year and semester first.");
      return;
    }
    const newEntry: CourseEntry = {
      course,
      year: formYear,
      semester: formSemester,
      goalGrade,
      entryType,
      credits: 3,
    };

    if (entryType === "final") {
      newEntry.finalGrade = finalGrade;
    } else {
      newEntry.assignments = currentAssignments;
    }

    if (isEditing && editId) {
      await updateCourseEntry(editId, newEntry);
      const courses = await loadCourses();
      setProgressData(courses);
      setIsEditing(false);
      setEditId(null);
    } else {
      await saveCourse(newEntry);
      const courses = await loadCourses();
      setProgressData(courses);
    }

    // Clear form fields
    setCourse("");
    setFormYear("");
    setFormSemester("");
    setGoalGrade("");
    setFinalGrade("");
    setCurrentAssignments([]);
    setCurrentAssignmentWeight(0);
    setAssignmentName("");
    setAssignmentGrade("");
  }

  // ----- Edit Handlers -----
  function handleEdit(id: string) {
    const courseToEdit = progressData.find((c) => c.id === id);
    if (!courseToEdit) return;
    setIsEditing(true);
    setEditId(id);
    setCourse(courseToEdit.course);
    setFormYear(courseToEdit.year);
    setFormSemester(courseToEdit.semester);
    setGoalGrade(courseToEdit.goalGrade);
    setEntryType(courseToEdit.entryType);
    if (courseToEdit.entryType === "final") {
      setFinalGrade(courseToEdit.finalGrade || "");
      setCurrentAssignments([]);
    } else {
      setFinalGrade("");
      setCurrentAssignments(courseToEdit.assignments || []);
    }
    setSelectedYear(courseToEdit.year);
    setSelectedSemester(courseToEdit.semester);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditId(null);
    setCourse("");
    setFormYear("");
    setFormSemester("");
    setGoalGrade("");
    setFinalGrade("");
    setCurrentAssignments([]);
    setCurrentAssignmentWeight(0);
    setAssignmentName("");
    setAssignmentGrade("");
  }

  // ----- Derived Values for Scale Preview -----
  const totalWeightEntered = currentAssignments.reduce((sum, a) => sum + a.weight, 0);
  const weightedSum = currentAssignments.reduce(
    (sum, a) => sum + ((a.grade ?? 0) * a.weight),
    0
  );
  const currentAverage = totalWeightEntered > 0 ? weightedSum / totalWeightEntered : 0;
  const computedLetter = percentageToLetter(currentAverage);
  const remainingWeight = 100 - totalWeightEntered;

  // ----- Analytics: Chart Data -----
  const semesterGroups: Record<string, CourseEntry[]> = {};
  progressData.forEach((entry) => {
    const key = `${entry.year} ${entry.semester}`;
    if (!semesterGroups[key]) {
      semesterGroups[key] = [];
    }
    semesterGroups[key].push(entry);
  });
  const labels: string[] = [];
  const dataValues: number[] = [];
  Object.keys(semesterGroups).forEach((groupKey) => {
    const cgpa = parseFloat(computeAverageCGPA(semesterGroups[groupKey]));
    labels.push(groupKey);
    dataValues.push(cgpa);
  });
  labels.push("Overall");
  dataValues.push(parseFloat(totalCgpa === "N/A" ? "0" : totalCgpa));
  const chartData = {
    labels,
    datasets: [
      {
        label: "CGPA",
        data: dataValues,
        backgroundColor: "rgba(255, 0, 0, 0.6)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
    ],
  };
  const chartOptions = {
    scales: {
      y: {
        min: 0,
        max: 10,
      },
    },
  };

  return (
    <div>
      <header>
        <h1>Academic Progress Tracker</h1>
      </header>
      <main>
        {/* Landing Dashboard */}
        <section id="landing-page">
          <h2>CGPA Dashboard</h2>
          <div id="total-cgpa-container">
            <span id="total-cgpa" style={{ filter: totalCgpaVisible ? "none" : "blur(4px)" }}>
              Total CGPA: {totalCgpa}
            </span>
            <button onClick={toggleTotalCgpa}>{totalCgpaVisible ? "Hide" : "Show"}</button>
          </div>
          <div id="year-selection">
            <h3>Select Year</h3>
            <div id="year-buttons">
              {["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029"].map(
                (y) => (
                  <button key={y} onClick={() => handleYearSelect(y)}>
                    {y}
                  </button>
                )
              )}
            </div>
          </div>
          {selectedYear && (
            <div id="semester-selection">
              <h3>Select Semester for {selectedYear}</h3>
              {["Winter", "Summer", "Fall"].map((s) => (
                <button key={s} onClick={() => handleSemesterSelect(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {selectedYear && selectedSemester && (
            <div id="filtered-cgpa">
              <h3>
                CGPA for {selectedYear} {selectedSemester}:
              </h3>
              <p>{termCgpa}</p>
            </div>
          )}
        </section>

        {/* Add / Edit Form */}
        {(selectedYear && selectedSemester) && (
          <section id="add-progress">
            <h2>{isEditing ? "Edit Class Progress" : "Add New Class Progress"}</h2>
            <form onSubmit={handleFormSubmit}>
              <label htmlFor="course">Course Code:</label>
              <input
                type="text"
                id="course"
                placeholder="e.g., CSC1010"
                pattern="[A-Za-z]{3}[0-9]{4}"
                title="Course code must be three letters followed by four numbers"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                required
              />

              <label htmlFor="year-form">Year:</label>
              <select
                id="year-form"
                value={formYear}
                onChange={(e) => setFormYear(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select year
                </option>
                {["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029"].map(
                  (y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  )
                )}
              </select>

              <label htmlFor="semester-form">Semester:</label>
              <select
                id="semester-form"
                value={formSemester}
                onChange={(e) => setFormSemester(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select semester
                </option>
                {["Winter", "Summer", "Fall"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <label htmlFor="goalGrade">Goal Grade (Letter):</label>
              <input
                type="text"
                id="goalGrade"
                placeholder="e.g., A, B+"
                pattern="^(A\\+|A|A\\-|B\\+|B|B\\-|C\\+|C|C\\-|D\\+|D|D\\-|E|F|ABS|EIN)$"
                title="Valid grades: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, E, F, ABS, EIN"
                value={goalGrade}
                onChange={(e) => setGoalGrade(e.target.value)}
                required
              />

              <p>Choose Entry Type:</p>
              <label>
                <input
                  type="radio"
                  name="entryType"
                  value="final"
                  checked={entryType === "final"}
                  onChange={() => setEntryType("final")}
                />{" "}
                Final Grade
              </label>
              <label>
                <input
                  type="radio"
                  name="entryType"
                  value="scale"
                  checked={entryType === "scale"}
                  onChange={() => setEntryType("scale")}
                />{" "}
                Grading Scale
              </label>

              {entryType === "final" ? (
                <div id="final-grade-container">
                  <label htmlFor="finalGrade">Final Grade (Letter):</label>
                  <input
                    type="text"
                    id="finalGrade"
                    placeholder="e.g., A, B+"
                    pattern="^(A\\+|A|A\\-|B\\+|B|B\\-|C\\+|C|C\\-|D\\+|D|D\\-|E|F|ABS|EIN)$"
                    title="Valid grades: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, E, F, ABS, EIN"
                    value={finalGrade}
                    onChange={(e) => setFinalGrade(e.target.value)}
                  />
                </div>
              ) : (
                <div id="scale-container">
                  <label htmlFor="assignmentWeight">Assignment Weight (%):</label>
                  <input
                    type="number"
                    id="assignmentWeight"
                    placeholder="Enter assignment weight (e.g., 10)"
                    value={currentAssignmentWeight}
                    onChange={(e) => setCurrentAssignmentWeight(Number(e.target.value))}
                    required
                  />

                  <div id="assignments-section">
                    <label htmlFor="assignmentName">Assignment Name:</label>
                    <input
                      type="text"
                      id="assignmentName"
                      placeholder="Enter assignment name"
                      value={assignmentName}
                      onChange={(e) => setAssignmentName(e.target.value)}
                    />

                    <label htmlFor="assignmentGrade">
                      Assignment Grade (leave blank if not graded):
                    </label>
                    <input
                      type="number"
                      id="assignmentGrade"
                      placeholder="Enter assignment grade"
                      value={assignmentGrade}
                      onChange={(e) => setAssignmentGrade(e.target.value)}
                      min={0}
                      max={100}
                    />

                    <button type="button" onClick={handleAddAssignment}>
                      Add Assignment
                    </button>

                    <ul id="assignmentList" style={{ marginTop: "10px" }}>
                      {currentAssignments.map((a, i) => (
                        <li key={i} style={{ marginBottom: "6px" }}>
                          {a.name || "Untitled"}:{" "}
                          {a.grade !== null ? `${a.grade}%` : "Not graded"} (Weight: {a.weight}%)
                          <button
                            type="button"
                            style={{
                              marginLeft: "10px",
                              padding: "4px 8px",
                              backgroundColor: "#555",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                            onClick={() => handleRemoveAssignment(i)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {currentAssignments.length > 0 && (
                    <div id="scaleResults" style={{ marginTop: "10px" }}>
                      <p>
                        Current Average: {currentAverage.toFixed(2)}% ({computedLetter})
                      </p>
                      <p>Assignments Entered: {currentAssignments.length}</p>
                      <p>
                        Remaining Weight: {remainingWeight > 0 ? remainingWeight.toFixed(2) : 0}%
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit">
                  {isEditing ? "Save Changes" : "Add Class Progress"}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    style={{ backgroundColor: "#666" }}
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* Course Table */}
        {(selectedYear && selectedSemester) && (
          <section id="progress-list">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>
                {viewMode === "thisSemester"
                  ? `Your Class Progress for ${selectedYear} ${selectedSemester}`
                  : "All Courses"}
              </h2>
              <div>
                <label style={{ marginRight: "10px" }}>View:</label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as "thisSemester" | "allCourses")}
                  style={{ padding: "8px", backgroundColor: "#333", color: "#fff", border: "1px solid #555", borderRadius: "4px" }}
                >
                  <option value="thisSemester">This Semester</option>
                  <option value="allCourses">All Courses</option>
                </select>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Year</th>
                  <th>Semester</th>
                  <th>Entry Type</th>
                  <th>Goal Grade</th>
                  <th>Current / Final Grade</th>
                  <th>Progress Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entriesToShow.map((entry) => {
                  const assignments = entry.assignments || [];
                  const totalW = assignments.reduce((sum, a) => sum + a.weight, 0);
                  const weightedSum = assignments.reduce(
                    (sum, a) => sum + ((a.grade ?? 0) * a.weight),
                    0
                  );
                  const avgPercentage = totalW > 0 ? weightedSum / totalW : 0;
                  const computedGrade = `${avgPercentage.toFixed(2)}% (${percentageToLetter(avgPercentage)})`;
                  const remain = 100 - totalW;
                  return (
                    <tr key={entry.id}>
                      <td>{entry.course}</td>
                      <td>{entry.year}</td>
                      <td>{entry.semester}</td>
                      <td>{entry.entryType === "final" ? "Final Grade" : "Grading Scale"}</td>
                      <td>{entry.goalGrade}</td>
                      <td>
                        {entry.entryType === "final"
                          ? entry.finalGrade
                          : computedGrade}
                      </td>
                      <td>
                        {entry.entryType === "final" ? (
                          "N/A"
                        ) : (
                          <>
                            <p>{assignments.length} Assignments Entered</p>
                            <p>
                              Remaining Weight: {remain > 0 ? remain.toFixed(2) : 0}%
                            </p>
                          </>
                        )}
                      </td>
                      <td>
                        <button onClick={() => entry.id && handleEdit(entry.id)}>Edit</button>
                        <button
                          onClick={async () => {
                            if (window.confirm("Are you sure you want to delete this entry?") && entry.id) {
                              await deleteCourseEntry(entry.id);
                              const courses = await loadCourses();
                              setProgressData(courses);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Analytics Section */}
        <section id="analytics">
          <h2>Analytics</h2>
          {progressData.length === 0 ? (
            <p>No data available for analytics.</p>
          ) : (
            <div style={{ backgroundColor: "#222", padding: "20px", borderRadius: "8px" }}>
              <ChartAnalytics progressData={progressData} totalCgpa={totalCgpa} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

// ----- ChartAnalytics Component -----
interface AnalyticsProps {
  progressData: CourseEntry[];
  totalCgpa: string;
}

const ChartAnalytics: React.FC<AnalyticsProps> = ({ progressData, totalCgpa }) => {
  const semesterGroups: Record<string, CourseEntry[]> = {};
  progressData.forEach((entry) => {
    const key = `${entry.year} ${entry.semester}`;
    if (!semesterGroups[key]) {
      semesterGroups[key] = [];
    }
    semesterGroups[key].push(entry);
  });
  const labels: string[] = [];
  const dataValues: number[] = [];
  Object.keys(semesterGroups).forEach((groupKey) => {
    const cgpa = parseFloat(computeAverageCGPA(semesterGroups[groupKey]));
    labels.push(groupKey);
    dataValues.push(cgpa);
  });
  labels.push("Overall");
  dataValues.push(parseFloat(totalCgpa === "N/A" ? "0" : totalCgpa));
  const chartData = {
    labels,
    datasets: [
      {
        label: "CGPA",
        data: dataValues,
        backgroundColor: "rgba(255, 0, 0, 0.6)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
    ],
  };
  const options = {
    scales: {
      y: {
        min: 0,
        max: 10,
      },
    },
  };

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

function computeAverageCGPA(entries: CourseEntry[]): string {
  if (entries.length === 0) return "N/A";
  let totalWeighted = 0;
  let totalCredits = 0;
  entries.forEach((entry) => {
    const credits = entry.credits || 3;
    totalWeighted += computeEntryNumeric(entry) * credits;
    totalCredits += credits;
  });
  return (totalWeighted / totalCredits).toFixed(2);
}

function computeEntryNumeric(entry: CourseEntry): number {
  if (entry.entryType === "final") {
    return letterToNumeric[entry.finalGrade || "F"] ?? 0;
  } else {
    const assignments = entry.assignments || [];
    const totalWeight = assignments.reduce((sum, a) => sum + a.weight, 0);
    const weightedSum = assignments.reduce(
      (sum, a) => sum + ((a.grade ?? 0) * a.weight),
      0
    );
    const avgPercentage = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const computedLetter = percentageToLetter(avgPercentage);
    return letterToNumeric[computedLetter] ?? 0;
  }
}

export default App;
