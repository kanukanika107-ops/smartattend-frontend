import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const FALLBACK_BASE_URL = "https://smartattend-backend-5irf.onrender.com";
const ENV_BASE_URL = import.meta.env.VITE_API_URL?.trim() || FALLBACK_BASE_URL;

const primaryTabs = [
  { id: "dashboard", label: "Session" },
  { id: "analytics", label: "Analytics" },
  { id: "ai", label: "AI Query" },
  { id: "verify", label: "Verify" }
];

const manageTabs = [
  { id: "classes", label: "Classes" },
  { id: "students", label: "Students" }
];

const emptyClassForm = {
  academicSessionId: "",
  academicSession: "2026-27",
  subjectName: "",
  classCode: "",
  section: "A"
};

const emptyAcademicForm = {
  label: "2026-27",
  startYear: "2026",
  endYear: "2027",
  isActive: true
};

const emptyStudentForm = {
  name: "",
  rollNo: "",
  semester: "",
  section: "A",
  photoFile: null,
  photoName: ""
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [baseUrl, setBaseUrl] = useState(
    () => localStorage.getItem("smartattend.baseUrl") || ENV_BASE_URL
  );
  const [token, setToken] = useState(
    () => sessionStorage.getItem("smartattend.token") || ""
  );
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });
  const [loginStatus, setLoginStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [academicSessions, setAcademicSessions] = useState([]);
  const [academicRange, setAcademicRange] = useState([]);
  const [academicForm, setAcademicForm] = useState(emptyAcademicForm);
  const [classes, setClasses] = useState([]);
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [bulkFile, setBulkFile] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [studentsPerPage, setStudentsPerPage] = useState(10);
  const [isDragging, setIsDragging] = useState(false);
  const [studentPhotoPreview, setStudentPhotoPreview] = useState("");
  const [editStudent, setEditStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    rollNo: "",
    semester: "",
    section: ""
  });
  const [sessionId, setSessionId] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(15);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [pulseMode, setPulseMode] = useState("create");
  const [qrExpired, setQrExpired] = useState(false);
  const [facultyQuery, setFacultyQuery] = useState("");
  const [facultyResult, setFacultyResult] = useState(null);
  const [studentAiQuery, setStudentAiQuery] = useState("");
  const [studentAiToken, setStudentAiToken] = useState("");
  const [studentAiResult, setStudentAiResult] = useState(null);
  const [questionTopic, setQuestionTopic] = useState("Database Normalization");
  const [questionCount, setQuestionCount] = useState(3);
  const [questionDrafts, setQuestionDrafts] = useState([]);
  const [currentPulseCheck, setCurrentPulseCheck] = useState(null);
  const [verifySessionInput, setVerifySessionInput] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);

  const authHeaders = useMemo(() => {
    if (!token) {
      return {};
    }
    return {
      Authorization: `Bearer ${token}`
    };
  }, [token]);

  const selectedClass = useMemo(
    () => classes.find((item) => item._id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const resolveMediaUrl = (value) => {
    if (!value) {
      return "";
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return `${baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
  };

  const noticeTimer = useRef(null);
  const socketRef = useRef(null);
  const qrTimerRef = useRef(null);
  const loginEmailRef = useRef(null);
  const loginPasswordRef = useRef(null);
  const loginButtonRef = useRef(null);

  useEffect(() => {
    if (!studentForm.photoFile) {
      setStudentPhotoPreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(studentForm.photoFile);
    setStudentPhotoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [studentForm.photoFile]);

  const requestJson = async (path, options = {}, auth = true) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(auth && token ? authHeaders : {}),
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    }
    return data;
  };

  const refreshAcademicSessions = async () => {
    if (!token) return;
    const data = await requestJson("/api/academic-sessions");
    setAcademicSessions(data.sessions || []);
  };

  const refreshAcademicRange = async () => {
    if (!token) return;
    const data = await requestJson("/api/academic-sessions/range");
    setAcademicRange(data.sessions || []);
  };

  const createAcademicSession = async (event) => {
    event.preventDefault();
    const startYear = Number(academicForm.startYear);
    const endYear = Number(academicForm.endYear);
    const label =
      academicForm.label.trim() ||
      (Number.isInteger(startYear) && Number.isInteger(endYear)
        ? `${startYear}-${String(endYear % 100).padStart(2, "0")}`
        : "");
    if (!label) {
      setMessage("Enter academic session label or year range.");
      return;
    }
    setLoading(true);
    try {
      await requestJson("/api/academic-sessions", {
        method: "POST",
        body: JSON.stringify({
          label,
          startYear: Number.isInteger(startYear) ? startYear : undefined,
          endYear: Number.isInteger(endYear) ? endYear : undefined,
          isActive: Boolean(academicForm.isActive)
        })
      });
      setAcademicForm(emptyAcademicForm);
      setMessage("Academic session created");
      await refreshAcademicSessions();
      await refreshAcademicRange();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const runFacultyQuery = async (event) => {
    event.preventDefault();
    if (!facultyQuery.trim()) {
      setMessage("Enter a faculty query.");
      return;
    }
    setLoading(true);
    try {
      const data = await requestJson("/api/ai/faculty-query", {
        method: "POST",
        body: JSON.stringify({ query: facultyQuery.trim() })
      });
      setFacultyResult(data);
      setMessage("Faculty query completed");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const runStudentQuery = async (event) => {
    event.preventDefault();
    const queryToken = studentAiToken.trim() || token;
    if (!studentAiQuery.trim()) {
      setMessage("Enter a student query.");
      return;
    }
    if (!queryToken) {
      setMessage("Student token is required for testing.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/ai/student-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${queryToken}`
        },
        body: JSON.stringify({ query: studentAiQuery.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Student query failed");
      }
      setStudentAiResult(data);
      setMessage("Student query completed");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async (event) => {
    event.preventDefault();
    if (!questionTopic.trim()) {
      setMessage("Enter a topic.");
      return;
    }
    setLoading(true);
    try {
      const data = await requestJson("/api/ai/generate-questions", {
        method: "POST",
        body: JSON.stringify({
          topic: questionTopic.trim(),
          count: Number(questionCount) || 3
        })
      });
      setQuestionDrafts((data.questions || []).map((q) => ({
        ...normalizeQuestion(q),
        approved: false
      })));
      setPulseMode("active");
      setMessage("Questions generated");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestionDraft = (index, field, value) => {
    setQuestionDrafts((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const normalizeQuestion = (question = {}) => {
    const options = Array.isArray(question.options)
      ? question.options
      : typeof question.optionsText === "string"
      ? question.optionsText
          .split(/[,;\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    return {
      text: question.text || question.question || "",
      options,
      optionsText: question.optionsText || options.join(", "),
      difficulty: question.difficulty || "medium",
      approved: Boolean(question.approved)
    };
  };

  const questionToPayload = (question = {}) => ({
    text: question.text || "",
    options: Array.isArray(question.options)
      ? question.options
      : String(question.optionsText || "")
          .split(/[,;\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
    difficulty: question.difficulty || "medium",
    approved: Boolean(question.approved)
  });

  const savePulseDraft = async () => {
    if (!sessionId) {
      setMessage("Select or start a session first.");
      return;
    }
    if (!questionDrafts.length) {
      setMessage("Generate or add questions first.");
      return;
    }
    setLoading(true);
    try {
      const payloadQuestions = questionDrafts.map((q) => questionToPayload(q));
      const body = { sessionId, topicKeywords: questionTopic, questions: payloadQuestions, durationSec: 240 };
      const data = currentPulseCheck?._id
        ? await requestJson(`/api/pulse-check/${currentPulseCheck._id}/questions`, {
            method: "PUT",
            body: JSON.stringify({ questions: payloadQuestions })
          })
        : await requestJson("/api/pulse-check/create", {
            method: "POST",
            body: JSON.stringify(body)
          });
      if (data.pulseCheck) {
        setCurrentPulseCheck(data.pulseCheck);
        setQuestionDrafts((data.pulseCheck.questions || payloadQuestions).map((q) => normalizeQuestion(q)));
      }
      setPulseMode("active");
      setMessage("Pulse draft saved");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const approvePulse = async () => {
    if (!currentPulseCheck?._id) {
      setMessage("Create or load a pulse draft first.");
      return;
    }
    setLoading(true);
    try {
      const data = await requestJson(`/api/pulse-check/${currentPulseCheck._id}/approve`, {
        method: "POST",
        body: JSON.stringify({ approveAll: true })
      });
      if (data.pulseCheck) {
        setCurrentPulseCheck(data.pulseCheck);
        setQuestionDrafts((data.pulseCheck.questions || []).map((q) => normalizeQuestion(q)));
      }
      setPulseMode("results");
      setMessage("Questions approved");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerPulse = async () => {
    if (!currentPulseCheck?._id) {
      setMessage("Create or load a pulse draft first.");
      return;
    }
    setLoading(true);
    try {
      const data = await requestJson(`/api/pulse-check/${currentPulseCheck._id}/trigger`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (data.pulseCheck) {
        setCurrentPulseCheck(data.pulseCheck);
      }
      setPulseMode("results");
      setMessage("Pulse check triggered");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifySession = async (event) => {
    event.preventDefault();
    const target = verifySessionInput.trim() || sessionId;
    if (!target) {
      setMessage("Enter a session id.");
      return;
    }
    setLoading(true);
    try {
      const data = await requestJson(`/api/verify/${target}`);
      setVerifyResult(data);
      setMessage("Session verified");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("smartattend.baseUrl", baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    if (token) {
      sessionStorage.setItem("smartattend.token", token);
      return;
    }
    sessionStorage.removeItem("smartattend.token");
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchClasses();
      refreshAcademicSessions();
      refreshAcademicRange();
    }
  }, [token, baseUrl]);

  useEffect(() => {
    if (token && selectedClassId && activeTab === "students") {
      fetchStudents();
    }
  }, [token, selectedClassId, activeTab]);

  useEffect(() => {
    if (activeTab === "students") {
      setStudentSearch("");
      setStudentPage(1);
    }
  }, [activeTab, selectedClassId]);


  useEffect(() => {
    if (selectedClassId) {
      setSessionId("");
      setQrToken("");
      setCheckins([]);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (!token) {
      loginEmailRef.current?.focus();
    }
  }, [token]);

  useEffect(() => {
    if (token && activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [token, activeTab, selectedClassId]);

  useEffect(() => {
    if (token) {
      setSessionId("");
      setQrToken("");
      setCheckins([]);
      setSelectedClassId("");
    }
  }, [token]);

  useEffect(() => {
    if (selectedClassId && !classes.find((item) => item._id === selectedClassId)) {
      setSelectedClassId("");
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    // QR is intentionally not auto-refreshed; the timer only marks it expired.
  }, [sessionId, token]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    setQrCountdown(15);
    setQrExpired(false);
    const timer = window.setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          setQrExpired(true);
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [qrToken, sessionId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const socket = io(baseUrl, {
      auth: { token },
      transports: ["websocket"]
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setSocketStatus("connected");
      if (sessionId) {
        socket.emit("join-session", sessionId);
      }
    });
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("attendance-update", (payload) => {
      if (!payload) {
        return;
      }
      const entry = {
        id: payload._id || `${Date.now()}`,
        name: payload.studentName || payload.name || "Student",
        rollNo: payload.rollNo || payload.roll || "--"
      };
      setCheckins((prev) => [entry, ...prev].slice(0, 10));
    });
    socket.on("new-quiz", (payload) => {
      if (Array.isArray(payload?.questions) && payload.questions.length) {
        setQuestionDrafts(payload.questions.map((q) => normalizeQuestion(q)));
      }
      setPulseMode("active");
      setMessage("New pulse check received");
    });
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [token, baseUrl, sessionId]);

  useEffect(() => {
    if (socketRef.current && sessionId) {
      socketRef.current?.emit("join-session", sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    if (students.length) {
      setStudentPage(1);
    }
  }, [students]);

  const setMessage = (message) => {
    setNotice(message);
    if (!message) {
      return;
    }
    if (noticeTimer.current) {
      window.clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = window.setTimeout(() => setNotice(""), 4000);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLoginStatus("");
    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Login failed");
      }
      setToken(data.token);
      setLoginStatus("Logged in as faculty");
      setMessage("Login successful");
      setActiveTab("classes");
    } catch (error) {
      setLoginStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    if (!token || !selectedClassId) {
      setMessage("Select a class first.");
      return;
    }
    const chosen = classes.find((item) => item._id === selectedClassId);
    if (!chosen) {
      setMessage("Class not found.");
      return;
    }
    setQrLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/sessions/start`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: chosen.classCode,
          section: chosen.section
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to start session");
      }
      setSessionId(data.sessionId);
      setQrToken(data.qrToken);
      setQrExpired(false);
      setMessage("Session started");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setQrLoading(false);
    }
  };

  const refreshQr = async (auto = false) => {
    if (!token || !sessionId) {
      return;
    }
    if (auto) {
      return;
    }
    setQrLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/qr`, {
        headers: authHeaders
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to refresh QR");
      }
      setQrToken(data.qrToken);
      setQrExpired(false);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setQrLoading(false);
    }
  };

  const closeSession = async () => {
    if (!token || !sessionId) {
      setMessage("Select a session first.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/close`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to close session");
      }
      setQrExpired(true);
      setQrToken("");
      setSessionId("");
      setCheckins([]);
      setMessage(data.message || "Session closed");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!token || !selectedClassId) {
      return;
    }
    const chosen = classes.find((item) => item._id === selectedClassId);
    if (!chosen?.classCode) {
      return;
    }
    try {
      const response = await fetch(
        `${baseUrl}/api/aqs/analytics/${encodeURIComponent(chosen.classCode)}`,
        { headers: authHeaders }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load analytics");
      }
      setAnalytics(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fetchClasses = async () => {
    if (!token) {
      setMessage("Please login first.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/classes`, {
        headers: authHeaders
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load classes");
      }
      setClasses(data.classes || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createClass = async (event) => {
    event.preventDefault();
    if (!token) {
      setMessage("Please login first.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/classes`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(classForm)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to create class");
      }
      setMessage("Class created");
      setClassForm(emptyClassForm);
      if (data?.class?._id) {
        setSelectedClassId(data.class._id);
        setActiveTab("dashboard");
      }
      await fetchClasses();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteClass = async (classId) => {
    if (!token) {
      setMessage("Please login first.");
      return;
    }
    const confirmed = window.confirm(
      "Delete this class? Students linked to it will be unassigned."
    );
    if (!confirmed) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/classes/${classId}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to delete class");
      }
      setMessage(data.message || "Class deleted");
      setSelectedClassId("");
      setSessionId("");
      setQrToken("");
      setCheckins([]);
      setAnalytics(null);
      await fetchClasses();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!token || !selectedClassId) {
      setMessage("Select a class first.");
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("classId", selectedClassId);
      if (studentSearch) {
        query.set("search", studentSearch);
      }
      const response = await fetch(`${baseUrl}/api/students?${query.toString()}`, {
        headers: authHeaders
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load students");
      }
      setStudents(data.students || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeStudent = async (studentId) => {
    if (!token) {
      setMessage("Please login first.");
      return;
    }
    const confirmed = window.confirm("Remove this student from the selected class?");
    if (!confirmed) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/students/${studentId}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to remove student");
      }
      setMessage(data.message || "Student removed");
      await fetchStudents();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const addStudent = async (event) => {
    event.preventDefault();
    if (!token || !selectedClassId) {
      setMessage("Select a class first.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", studentForm.name);
      formData.append("rollNo", studentForm.rollNo);
      if (studentForm.semester) {
        formData.append("semester", studentForm.semester);
      }
      if (studentForm.section) {
        formData.append("section", studentForm.section);
      }
      if (studentForm.photoFile) {
        formData.append("photo", studentForm.photoFile);
      }
      const response = await fetch(
        `${baseUrl}/api/classes/${selectedClassId}/students`,
        {
          method: "POST",
          headers: authHeaders,
          body: formData
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to add student");
      }
      setGeneratedPassword(data.generatedPassword || "");
      setStudentForm(emptyStudentForm);
      setMessage("Student added");
      await fetchStudents();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadBulk = async (event) => {
    event.preventDefault();
    if (!token || !selectedClassId || !bulkFile) {
      setMessage("Select a class and CSV file.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      const response = await fetch(
        `${baseUrl}/api/classes/${selectedClassId}/students/bulk`,
        {
          method: "POST",
          headers: authHeaders,
          body: formData
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Bulk upload failed");
      }
      setMessage(`Bulk upload done: ${data.created || 0} students`);
      setBulkFile(null);
      setActiveTab("students");
      await fetchStudents();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportStudents = () => {
    if (!students.length) {
      setMessage("No students to export.");
      return;
    }
    const rows = [
      ["name", "rollNo", "semester", "section"].join(","),
      ...students.map((student) =>
        [
          student.name || "",
          student.rollNo || "",
          student.semester || "",
          student.section || ""
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "students-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openEditModal = (student) => {
    setEditStudent(student);
    setEditForm({
      name: student.name || "",
      rollNo: student.rollNo || "",
      semester: student.semester || "",
      section: student.section || ""
    });
  };

  const closeEditModal = () => {
    setEditStudent(null);
  };

  const updateStudent = async (event) => {
    event.preventDefault();
    if (!token || !editStudent) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/students/${editStudent._id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update student");
      }
      setMessage("Student updated");
      setEditStudent(null);
      await fetchStudents();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(students.length / studentsPerPage));
  const pageStart = (studentPage - 1) * studentsPerPage;
  const paginatedStudents = students.slice(pageStart, pageStart + studentsPerPage);

  const handleLoginFieldKeyDown = (event, nextRef) => {
    if (event.key === "Enter") {
      event.preventDefault();
      nextRef.current?.focus();
    }
  };

  if (!token) {
    return (
      <div className="app auth-only">
        <main className="content auth-content">
          {notice && <div className="notice">{notice}</div>}
          <section className="login-shell">
            <div className="login-hero panel">
              <p className="login-kicker">SmartAttend</p>
              <h1>SmartAttend Login</h1>
              <p className="login-intro">
                Enter faculty credentials to access the dashboard.
              </p>
              <div className="login-points">
                <div>
                  <strong>Live QR</strong>
                  <span>Manage sessions and attendance in real time.</span>
                </div>
                <div>
                  <strong>Student Tools</strong>
                  <span>Add students, upload photos, and keep records organized.</span>
                </div>
              </div>
              <p className="login-note">Tip: Enter moves you to the next field.</p>
            </div>
            <div className="panel login-panel login-card">
              <div className="login-card-head">
                <h2>Faculty Login</h2>
                <p>Use your email and password to manage classes and students.</p>
              </div>
              <form className="login-form" autoComplete="off" onSubmit={handleLogin}>
                <label className="login-field">
                  <span>Email</span>
                  <input
                    ref={loginEmailRef}
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    onKeyDown={(event) => handleLoginFieldKeyDown(event, loginPasswordRef)}
                    placeholder="Enter faculty email"
                    autoComplete="username"
                    autoFocus
                  />
                </label>
                <label className="login-field">
                  <span>Password</span>
                  <input
                    ref={loginPasswordRef}
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((prev) => ({
                        ...prev,
                        password: event.target.value
                      }))
                    }
                    onKeyDown={(event) => handleLoginFieldKeyDown(event, loginButtonRef)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                </label>
                <button ref={loginButtonRef} disabled={loading} type="submit">
                  {loading ? "Please wait..." : "Login to Dashboard"}
                </button>
              </form>
              {loginStatus && <p className="hint">{loginStatus}</p>}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">SA</div>
          <div>
            <p className="brand-title">SmartAttend</p>
            <p className="brand-subtitle">Faculty Dashboard</p>
          </div>
        </div>

        <nav className="nav">
          {primaryTabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="nav-section">
          <p className="nav-title">Management</p>
          {manageTabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="sidebar-card sidebar-backend-card">
          <div className="sidebar-card-head">
            <div>
              <h4>Backend</h4>
              <p>Live API connected</p>
            </div>
            <span className="status-pill status-pill-soft">Ready</span>
          </div>
          <p className="hint">
            Frontend is already using the live Render API in the background.
          </p>
          <button className="secondary" onClick={fetchClasses}>
            Refresh Classes
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>
              {[...primaryTabs, ...manageTabs].find((tab) => tab.id === activeTab)
                ?.label}
            </h1>
            <p>Manage sessions, students, and class data.</p>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">Authenticated</div>
            <button
              className="ghost"
              onClick={() => {
                setToken("");
                setLoginForm({ email: "", password: "" });
                setLoginStatus("");
                setActiveTab("dashboard");
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {activeTab === "dashboard" && (
          <section className="session-dashboard">
            <div className="session-header">
              <div>
                <h2>Session Control Dashboard</h2>
                <p>
                  Manage live QR attendance, monitor student check-ins, and run
                  AI pulse checks during class.
                </p>
              </div>
              <div className="session-actions">
                <button
                  className="secondary"
                  onClick={startSession}
                  disabled={!selectedClassId}
                >
                  {qrLoading ? "Starting..." : "Start New Session"}
                </button>
                <button
                  className="ghost"
                  onClick={closeSession}
                  disabled={!sessionId}
                >
                  Close Session
                </button>
                <select
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                >
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.subjectName} ({item.classCode}) - {item.academicSession}
                    </option>
                  ))}
                  </select>
              </div>
            </div>
            {selectedClass && (
              <p className="hint">
                Selected class: <strong>{selectedClass.subjectName}</strong> (
                {selectedClass.classCode}) - Session {selectedClass.academicSession}
              </p>
            )}

            {!classes.length ? (
              <div className="empty-state card">
                <h3>Add a class first</h3>
                <p className="hint">
                  Go to Classes tab, create your class, then come back here to
                  start the session.
                </p>
              </div>
            ) : !selectedClassId ? (
              <div className="empty-state card">
                <h3>Select a class to start</h3>
                <p className="hint">
                  Saved classes will appear in the dropdown. Choose one to
                  enable QR, live attendance, and pulse check.
                </p>
              </div>
            ) : (
              <div className="session-grid">
                <div className="card qr-card">
                  <div className="card-badge">Live QR Session</div>
                  <div className="card-title-row">
                    <h3>Student Check-in QR</h3>
                    <span className="live-pill">Live</span>
                  </div>
                  <div className="qr-placeholder">
                  {sessionId && qrToken ? (
                    <img
                      className={`qr-image ${qrExpired ? "expired" : ""}`}
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        qrToken
                      )}`}
                      alt="QR Code"
                    />
                  ) : qrLoading ? (
                    <div className="qr-box loading">Loading...</div>
                  ) : (
                    <div className="qr-box">QR</div>
                  )}
                  <p className="qr-text">
                      {qrExpired
                        ? "QR expired. Start a new session."
                        : sessionId
                        ? "QR token will appear here"
                        : "Start a session to generate QR"}
                  </p>
                </div>
                  <button
                    className="refresh-box"
                    onClick={refreshQr}
                    disabled={!sessionId || qrExpired}
                  >
                    {qrLoading
                      ? "Refreshing..."
                      : sessionId
                      ? qrExpired
                        ? "QR expired"
                        : `Refresh in: ${qrCountdown}s`
                      : "Start session first"}
                  </button>
                </div>

                <div className="stack">
                  <div className="card">
                    <div className="card-badge subtle">Live Feed</div>
                    <h3>Student Check-ins</h3>
                    <p className="hint socket-status">
                      Socket: {socketStatus}
                    </p>
                    {checkins.length ? (
                      <ul className="checkin-list">
                        {checkins.map((item) => (
                          <li key={item.id}>
                            <strong>{item.name}</strong>
                            <span>Roll {item.rollNo}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">No live attendance yet.</p>
                    )}
                  </div>

                    <div className="card pulse-card">
                      <div className="card-badge subtle">AI Pulse Check</div>
                      <h3>Quiz & Response Panel</h3>
                      <div className="pill-row">
                        {["create", "active", "results"].map((mode) => (
                        <button
                          key={mode}
                          className={`pill ${pulseMode === mode ? "active" : ""}`}
                          onClick={() => {
                            setPulseMode(mode);
                            setMessage(`Pulse check mode: ${mode}`);
                          }}
                          type="button"
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                      </div>
                      <div className="pulse-box">
                        <strong>Quiz Topic:</strong> {questionTopic || "Database Normalization"}
                        <p>
                          Generate questions in the AI tab, then review them here
                          before saving the pulse check.
                        </p>
                      </div>
                      <div className="question-grid" style={{ marginTop: 12 }}>
                        <button type="button" className="ghost" onClick={() => setActiveTab("ai")}>
                          Generate Draft
                        </button>
                        <button type="button" className="ghost" onClick={savePulseDraft}>
                          Save Draft
                        </button>
                        <button type="button" className="ghost" onClick={approvePulse}>
                          Approve All
                        </button>
                        <button type="button" className="secondary" onClick={triggerPulse}>
                          Trigger Now
                        </button>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        {questionDrafts.length ? (
                          questionDrafts.map((q, index) => (
                            <div key={`${index}-${q.text}`} className="card" style={{ marginBottom: 12 }}>
                              <label className="inline-check" style={{ marginBottom: 10 }}>
                                <input
                                  type="checkbox"
                                  checked={q.approved}
                                  onChange={(event) =>
                                    setQuestionDrafts((prev) =>
                                      prev.map((item, idx) =>
                                        idx === index ? { ...item, approved: event.target.checked } : item
                                      )
                                    )
                                  }
                                />
                                Approved
                              </label>
                              <label>
                                Text
                                <textarea
                                  rows={2}
                                  value={q.text}
                                  onChange={(event) =>
                                    setQuestionDrafts((prev) =>
                                      prev.map((item, idx) =>
                                        idx === index ? { ...item, text: event.target.value } : item
                                      )
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Options
                                <input
                                  value={q.optionsText}
                                  onChange={(event) =>
                                    setQuestionDrafts((prev) =>
                                      prev.map((item, idx) =>
                                        idx === index ? { ...item, optionsText: event.target.value } : item
                                      )
                                    )
                                  }
                                />
                              </label>
                            </div>
                          ))
                        ) : (
                          <p className="hint">No questions yet. Generate them from the AI tab.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </section>
        )}

        {activeTab === "analytics" && (
          <section className="panel">
            <h2>Analytics</h2>
            {analytics ? (
              <div className="analytics-grid">
                <div className="card">
                  <h3>Average AQS</h3>
                  <strong>{analytics.averageAQS ?? "NA"}</strong>
                </div>
                <div className="card">
                  <h3>Total Students</h3>
                  <strong>{analytics.totalStudents ?? "NA"}</strong>
                </div>
                <div className="card">
                  <h3>Subject Code</h3>
                  <strong>{analytics.subjectId ?? "NA"}</strong>
                </div>
              </div>
            ) : (
              <p className="hint">Select a class to load AQS analytics.</p>
            )}
          </section>
        )}

        {activeTab === "ai" && (
          <section className="panel split">
            <div>
              <div className="panel-head">
                <h2>AI Query</h2>
                <button type="button" className="secondary" onClick={() => fetch(`${baseUrl}/api/ai/sync-embeddings`, { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, body: JSON.stringify({}) }).then(async (res) => {
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || "Unable to sync embeddings");
                  setMessage(data.message || "Embeddings synced");
                }).catch((error) => setMessage(error.message))}>
                  Sync Embeddings
                </button>
              </div>
              <form className="form-stack" onSubmit={runFacultyQuery}>
                <label>
                  Faculty Query
                  <textarea rows={4} value={facultyQuery} onChange={(e) => setFacultyQuery(e.target.value)} placeholder="Which students are scoring low in attendance analytics?" />
                </label>
                <button type="submit" disabled={loading}>Ask AI</button>
              </form>
              {facultyResult && (
                <div className="card section-gap">
                  <p className="card-badge subtle">Faculty Response</p>
                  <p>{facultyResult.aiResponse}</p>
                  <div className="mini-stats">
                    <span>Mode: {facultyResult.retrievalMode || "NA"}</span>
                    <span>Retrieved: {facultyResult.retrievedCount || 0}</span>
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="panel-head">
                <h2>Question Generator</h2>
                <button type="button" className="ghost" onClick={() => setActiveTab("dashboard")}>Open Pulse Builder</button>
              </div>
              <form className="form-stack" onSubmit={generateQuestions}>
                <label>
                  Topic
                  <input value={questionTopic} onChange={(e) => setQuestionTopic(e.target.value)} placeholder="Database Normalization" />
                </label>
                <label>
                  Question Count
                  <input type="number" min="1" max="10" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} />
                </label>
                <button type="submit" disabled={loading}>Generate Questions</button>
              </form>
              {questionDrafts.length > 0 && (
                <div className="card section-gap">
                  <p className="card-badge subtle">Latest Draft</p>
                  <div className="list">
                    {questionDrafts.slice(0, 3).map((q, index) => (
                      <div key={index} className="list-item">
                        <div>
                          <h4>{q.text || `Question ${index + 1}`}</h4>
                          <p>{q.optionsText || "No options yet"}</p>
                        </div>
                        <div className="tag">{q.difficulty || "medium"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <form className="form-stack section-gap" onSubmit={runStudentQuery}>
                <div className="panel-head"><h2>Student Query Tester</h2></div>
                <label>
                  Student Token Override
                  <input value={studentAiToken} onChange={(e) => setStudentAiToken(e.target.value)} placeholder="Paste student JWT here if testing student AI" />
                </label>
                <label>
                  Student Query
                  <textarea rows={4} value={studentAiQuery} onChange={(e) => setStudentAiQuery(e.target.value)} placeholder="What is my latest attendance score?" />
                </label>
                <button type="submit" disabled={loading}>Run Student Query</button>
              </form>
              {studentAiResult && (
                <div className="card section-gap">
                  <p className="card-badge subtle">Student Response</p>
                  <p>{studentAiResult.aiResponse}</p>
                  <div className="mini-stats">
                    <span>Mode: {studentAiResult.retrievalMode || "NA"}</span>
                    <span>Retrieved: {studentAiResult.retrievedCount || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "verify" && (
          <section className="panel split">
            <div>
              <h2>Blockchain Verification</h2>
              <form className="form-stack" onSubmit={verifySession}>
                <label>
                  Session ID
                  <input value={verifySessionInput} onChange={(e) => setVerifySessionInput(e.target.value)} placeholder={sessionId || "Paste session id"} />
                </label>
                <button type="submit" disabled={loading}>Verify Session</button>
              </form>
            </div>
            <div>
              {verifyResult ? (
                <div className="card">
                  <p className="card-badge subtle">Verification Result</p>
                  <div className="mini-stats">
                    <span>Status: {verifyResult.status || "NA"}</span>
                    <span>Session: {verifyResult.sessionId || "NA"}</span>
                  </div>
                  <pre className="json-block">{JSON.stringify(verifyResult.verification || verifyResult, null, 2)}</pre>
                </div>
              ) : (
                <div className="empty-soft">Verify a session to view the proof details.</div>
              )}
            </div>
          </section>
        )}

        {activeTab === "classes" && (
          <section className="panel split">
            <div>
              <h2>Create Academic Session</h2>
              <form className="form-stack" onSubmit={createAcademicSession}>
                <label>
                  Session Label
                  <input
                    list="academic-session-range"
                    value={academicForm.label}
                    onChange={(event) =>
                      setAcademicForm((prev) => ({ ...prev, label: event.target.value }))
                    }
                    placeholder="2026-27"
                  />
                  <datalist id="academic-session-range">
                    {academicRange.map((session) => (
                      <option key={session.label} value={session.label} />
                    ))}
                  </datalist>
                </label>
                <div className="question-grid">
                  <label>
                    Start Year
                    <input
                      type="number"
                      value={academicForm.startYear}
                      onChange={(event) =>
                        setAcademicForm((prev) => ({ ...prev, startYear: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    End Year
                    <input
                      type="number"
                      value={academicForm.endYear}
                      onChange={(event) =>
                        setAcademicForm((prev) => ({ ...prev, endYear: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={academicForm.isActive}
                    onChange={(event) =>
                      setAcademicForm((prev) => ({ ...prev, isActive: event.target.checked }))
                    }
                  />
                  Active session
                </label>
                <button disabled={loading} type="submit">Save Academic Session</button>
              </form>

              <div className="section-gap" />
              <h2>Create Class</h2>
              <form className="form-stack" onSubmit={createClass}>
                <label>
                  Saved Academic Session
                  <select
                    value={classForm.academicSessionId}
                    onChange={(event) =>
                      setClassForm((prev) => ({
                        ...prev,
                        academicSessionId: event.target.value,
                        academicSession: event.target.value ? "" : prev.academicSession
                      }))
                    }
                  >
                    <option value="">Use manual label below</option>
                    {academicSessions.map((session) => (
                      <option key={session._id} value={session._id}>
                        {session.label} {session.isActive ? "(active)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Manual Session Label
                  <input
                    list="academic-session-range"
                    value={classForm.academicSession}
                    onChange={(event) =>
                      setClassForm((prev) => ({
                        ...prev,
                        academicSession: event.target.value,
                        academicSessionId: ""
                      }))
                    }
                  />
                </label>
                <label>
                  Subject Name
                  <input
                    value={classForm.subjectName}
                    onChange={(event) =>
                      setClassForm((prev) => ({
                        ...prev,
                        subjectName: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  Class Code
                  <input
                    value={classForm.classCode}
                    onChange={(event) =>
                      setClassForm((prev) => ({
                        ...prev,
                        classCode: event.target.value.toUpperCase()
                      }))
                    }
                  />
                </label>
                <label>
                  Section
                  <input
                    value={classForm.section}
                    onChange={(event) =>
                      setClassForm((prev) => ({
                        ...prev,
                        section: event.target.value.toUpperCase()
                      }))
                    }
                  />
                </label>
                <button disabled={loading} type="submit">Add Class</button>
              </form>
            </div>
            <div>
              <div className="panel-head">
                <h2>Academic Sessions</h2>
                <button className="secondary" onClick={refreshAcademicSessions}>
                  Refresh
                </button>
              </div>
              <div className="list section-gap">
                {academicSessions.map((session) => (
                  <div key={session._id} className="list-item">
                    <div>
                      <h4>{session.label}</h4>
                      <p>{session.startYear || "NA"} - {session.endYear || "NA"}</p>
                    </div>
                    <div className="tag">{session.isActive ? "Active" : "Inactive"}</div>
                  </div>
                ))}
                {!academicSessions.length && <p className="hint">No academic sessions yet.</p>}
              </div>
              <div className="panel-head">
                <h2>Existing Classes</h2>
                <button className="secondary" onClick={fetchClasses}>
                  Refresh
                </button>
              </div>
              <div className="list">
                {classes.map((item) => (
                  <div key={item._id} className="list-item">
                    <div>
                      <h4>{item.subjectName}</h4>
                      <p>
                        {item.classCode} • {item.section} • {item.academicSession}
                      </p>
                    </div>
                    <div className="list-actions">
                      <button
                        className="ghost"
                        onClick={() => {
                          setSelectedClassId(item._id);
                          setActiveTab("students");
                        }}
                      >
                        Manage
                      </button>
                      <button
                        className="danger"
                        onClick={() => deleteClass(item._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!classes.length && (
                  <p className="hint">No classes yet. Create one to start.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "students" && (
          <section className="panel split">
            <div>
              <h2>Add Student</h2>
              <form className="form-stack" onSubmit={addStudent}>
                <label>
                  Class
                  <select
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                  >
                    <option value="">Select class</option>
                    {classes.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.subjectName} ({item.classCode}) - {item.academicSession}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Student Name
                  <input
                    value={studentForm.name}
                    onChange={(event) =>
                      setStudentForm((prev) => ({
                        ...prev,
                        name: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  Roll No
                  <input
                    value={studentForm.rollNo}
                    onChange={(event) =>
                      setStudentForm((prev) => ({
                        ...prev,
                        rollNo: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  Semester
                  <input
                    value={studentForm.semester}
                    onChange={(event) =>
                      setStudentForm((prev) => ({
                        ...prev,
                        semester: event.target.value
                      }))
                    }
                    placeholder="optional"
                  />
                </label>
                <label>
                  Section
                  <input
                    value={studentForm.section}
                    onChange={(event) =>
                      setStudentForm((prev) => ({
                        ...prev,
                        section: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="file-input">
                  JPEG Photo (optional)
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,.jpg,.jpeg"
                    onChange={(event) =>
                      setStudentForm((prev) => ({
                        ...prev,
                        photoFile: event.target.files?.[0] || null,
                        photoName: event.target.files?.[0]?.name || ""
                      }))
                    }
                  />
                </label>
                {studentPhotoPreview && (
                  <div className="photo-preview">
                    <img src={studentPhotoPreview} alt="Selected student" />
                    <div>
                      <strong>Photo selected</strong>
                      <p className="hint">
                        {studentForm.photoName || "Preview from your local device"}
                      </p>
                    </div>
                  </div>
                )}
                <button disabled={loading} type="submit">
                  Add Student
                </button>
              </form>
              {generatedPassword && (
                <div className="password-card">
                  <p>Generated Password</p>
                  <strong>{generatedPassword}</strong>
                </div>
              )}
            </div>
            <div>
              <div className="panel-head">
                <h2>Student List</h2>
                <div className="panel-actions">
                  <button className="ghost" onClick={exportStudents}>
                    Export CSV
                  </button>
                  <button className="secondary" onClick={fetchStudents}>
                    Refresh
                  </button>
                </div>
              </div>
              <div className="search-row">
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search by name or roll no"
                />
                <button className="ghost" onClick={fetchStudents}>
                  Search
                </button>
              </div>
              <div className="pagination-bar">
                <div className="page-info">
                  Page {studentPage} of {totalPages}
                </div>
                <div className="page-controls">
                  <button
                    className="ghost"
                    onClick={() => setStudentPage((prev) => Math.max(1, prev - 1))}
                    disabled={studentPage === 1}
                  >
                    Prev
                  </button>
                  <button
                    className="ghost"
                    onClick={() =>
                      setStudentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={studentPage === totalPages}
                  >
                    Next
                  </button>
                  <select
                    value={studentsPerPage}
                    onChange={(event) => {
                      setStudentsPerPage(Number(event.target.value));
                      setStudentPage(1);
                    }}
                  >
                    {[5, 10, 15, 20].map((size) => (
                      <option key={size} value={size}>
                        {size} / page
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="list">
                {paginatedStudents.map((student) => (
                  <div key={student._id} className="list-item">
                    {student.photoUrl && (
                      <img
                        src={resolveMediaUrl(student.photoUrl)}
                        alt={student.name}
                        className="student-thumb"
                      />
                    )}
                    <div>
                      <h4>{student.name}</h4>
                      <p>Roll: {student.rollNo}</p>
                      <p className="hint">
                        {student.section ? `Section ${student.section}` : "Section NA"}{" "}
                        {student.semester ? `• Semester ${student.semester}` : ""}
                      </p>
                    </div>
                    <div className="list-actions">
                      <div className="tag">Active</div>
                      <button
                        className="danger"
                        onClick={() => removeStudent(student._id)}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!students.length && (
                  <p className="hint">No students found for this class.</p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
