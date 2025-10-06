import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    collection, 
    query, 
    onSnapshot, 
    setDoc, 
    deleteDoc, 
    serverTimestamp 
} from 'firebase/firestore';
import { LayoutDashboard, Users, Zap, Briefcase, FileText, Settings, LogOut, ChevronRight, CheckCircle, X, Plus, Edit3, Trash2, Calendar, Clock } from 'lucide-react';

// --- Firebase Setup (MANDATORY GLOBALS) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, db, auth;
if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

// --- CONSTANTS ---
const CANDIDATE_STATUSES = ['Onboarding', 'Marketing', 'Interviewing', 'Offered', 'Placed', 'Rejected'];
const RECRUITER_NAMES = ['Kartavya', 'Satyam', 'Pawan', 'Harsh Panchal', 'Bhumin Patel', 'Kajal Agrawal']; 

// --- SHARED COMPONENTS ---

const Card = ({ children, className = '' }) => (
    <div className={\g-white rounded-xl shadow-lg border border-gray-100 \\}>
        {children}
    </div>
);

const Button = ({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '' }) => {
    let baseStyle = 'px-4 py-2 rounded-xl text-sm font-semibold transition duration-150 shadow-md flex items-center justify-center';
    if (variant === 'primary') {
        baseStyle += ' bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400';
    } else if (variant === 'secondary') {
        baseStyle += ' bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100';
    } else if (variant === 'danger') {
        baseStyle += ' bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400';
    }
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={\\ \\}>
            {children}
        </button>
    );
};

// --- CANDIDATE PORTAL COMPONENTS ---

const StatusBadge = ({ status }) => {
    const colorMap = {
        Onboarding: 'bg-gray-200 text-gray-700',
        Marketing: 'bg-indigo-100 text-indigo-700',
        Interviewing: 'bg-yellow-100 text-yellow-700',
        Offered: 'bg-green-100 text-green-700',
        Placed: 'bg-blue-100 text-blue-700',
        Rejected: 'bg-red-100 text-red-700',
    };
    return (
        <span className={\px-3 py-1 text-xs font-medium rounded-full \\}>
            {status}
        </span>
    );
};

const Input = ({ label, name, type = 'text', value, onChange, required = false, className = '' }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            className={\w-full p-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition \\}
        />
    </div>
);

const Select = ({ label, name, value, onChange, required = false, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
        <select
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            className="w-full p-3 border border-gray-300 rounded-xl bg-white focus:ring-blue-500 focus:border-blue-500 transition"
        >
            {children}
        </select>
    </div>
);

const CandidateForm = ({ candidate, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: candidate?.name || '',
        tech: candidate?.tech || '',
        visa: candidate?.visa || '',
        cityState: candidate?.cityState || '',
        marketingStartDate: candidate?.marketingStartDate || '',
        assignedRecruiter: candidate?.assignedRecruiter || RECRUITER_NAMES[0],
        status: candidate?.status || CANDIDATE_STATUSES[0],
        ...candidate,
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <Card className="w-full max-w-2xl bg-white shadow-2xl">
                <div className="flex justify-between items-center border-b p-4">
                    <h2 className="text-xl font-semibold text-gray-800">{candidate?.id ? 'Edit Candidate' : 'Create New Candidate'}</h2>
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition"><X /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <Input label="Candidate Name" name="name" value={formData.name} onChange={handleChange} required />
                    <Input label="Tech/Domain" name="tech" value={formData.tech} onChange={handleChange} required />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Visa Status" name="visa" value={formData.visa} onChange={handleChange} required />
                        <Input label="City/State" name="cityState" value={formData.cityState} onChange={handleChange} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Marketing Start Date" name="marketingStartDate" type="date" value={formData.marketingStartDate} onChange={handleChange} required={formData.status === 'Marketing'} />
                        <Select label="Status" name="status" value={formData.status} onChange={handleChange}>
                            {CANDIDATE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </div>
                    <Select label="Assigned Recruiter" name="assignedRecruiter" value={formData.assignedRecruiter} onChange={handleChange}>
                        {RECRUITER_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>

                    <div className="flex justify-end pt-4 space-x-3 border-t">
                        <Button type="button" onClick={onCancel} variant="secondary">Cancel</Button>
                        <Button type="submit">{candidate?.id ? 'Save Changes' : 'Create Candidate'}</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

const CandidatePortal = ({ userId, authReady, onNavigate }) => {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCandidate, setEditingCandidate] = useState(null);

    // Data Fetching (Real-time with onSnapshot)
    useEffect(() => {
        if (!db || !userId || !authReady) return;

        // Firestore Path: /artifacts/{appId}/users/{userId}/candidates (Private Data)
        const candidatesCollectionRef = collection(db, \rtifacts/\/users/\/candidates\);
        // We avoid orderBy here to prevent the need for manual index creation
        const q = query(candidatesCollectionRef); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedCandidates = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)); // Sort in memory by most recent
            
            setCandidates(fetchedCandidates);
            setLoading(false);
        }, (error) => {
            console.error("Firestore fetch error: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authReady, userId]);

    // CRUD Operations
    const handleSaveCandidate = useCallback(async (formData) => {
        if (!db || !userId) {
            console.error("Database or User ID not available for save operation.");
            return;
        }

        const candidateRef = formData.id 
            ? doc(db, \rtifacts/\/users/\/candidates\, formData.id)
            : doc(collection(db, \rtifacts/\/users/\/candidates\));
        
        try {
            await setDoc(candidateRef, {
                ...formData,
                createdAt: formData.id ? formData.createdAt : serverTimestamp(),
                updatedAt: serverTimestamp(),
                journeyMetrics: {
                    apps: 0,
                    interviews: 0,
                    assessments: 0,
                    offered: false,
                }
            }, { merge: true });

            setEditingCandidate(null);
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving candidate:", error);
        }
    }, [userId]);

    const handleDeleteCandidate = useCallback(async (candidateId) => {
        if (!db || !userId) return;
        
        // Use custom modal or simple confirmation logic (avoiding window.confirm)
        if (confirm("Are you sure you want to delete this candidate?")) {
            try {
                const candidateRef = doc(db, \rtifacts/\/users/\/candidates\, candidateId);
                await deleteDoc(candidateRef);
            } catch (error) {
                console.error("Error deleting candidate:", error);
            }
        }
    }, [userId]);


    // UI Handlers
    const openCreateForm = () => {
        setEditingCandidate(null);
        setIsFormOpen(true);
    };

    const openEditForm = (candidate) => {
        setEditingCandidate(candidate);
        setIsFormOpen(true);
    };

    // Derived State (Pipeline Metrics for Dashboard Snapshot)
    const pipelineMetrics = useMemo(() => {
        const counts = { total: candidates.length };
        CANDIDATE_STATUSES.forEach(status => {
            counts[status.toLowerCase()] = candidates.filter(c => c.status === status).length;
        });
        return counts;
    }, [candidates]);


    if (!authReady || loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center bg-gray-50">
                <div className="text-xl text-blue-600">Loading Candidate Portal...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
            <header className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900 flex items-center space-x-3">
                    <Users className="w-8 h-8 text-blue-600" />
                    <span>Candidate Management Portal</span>
                </h1>
                <p className="text-gray-500">Total Candidates: {pipelineMetrics.total}. User ID: {userId.substring(0, 8)}...</p>
            </header>

            {/* Pipeline Metrics Section */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                {CANDIDATE_STATUSES.map(status => (
                    <Card key={status} className="p-4 flex flex-col items-center justify-center text-center transition hover:shadow-lg">
                        <p className="text-3xl font-bold text-gray-800">{pipelineMetrics[status.toLowerCase()]}</p>
                        <p className="text-sm font-medium text-gray-500">{status}</p>
                    </Card>
                ))}
            </div>

            {/* Candidate List Header & Action */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-800">Candidate Pipeline ({candidates.length})</h2>
                <Button onClick={openCreateForm} variant="primary" className="flex items-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>Add New Candidate</span>
                </Button>
            </div>

            {/* Candidate List Table */}
            <Card className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tech / Visa</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recruiter</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {candidates.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No candidates found. Click "Add New Candidate" to start the pipeline.</td>
                            </tr>
                        ) : (
                            candidates.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{c.name}</div>
                                        <div className="text-xs text-gray-500">{c.cityState}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 font-medium">{c.tech}</div>
                                        <div className="text-xs text-gray-500">{c.visa}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center space-x-1">
                                            <Users className="w-4 h-4 text-blue-500" />
                                            <span>{c.assignedRecruiter}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <StatusBadge status={c.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <Button onClick={() => openEditForm(c)} variant="secondary" className="p-2">
                                            <Edit3 className="w-4 h-4" />
                                        </Button>
                                        <Button onClick={() => handleDeleteCandidate(c.id)} variant="danger" className="p-2">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Candidate Form Modal */}
            {(isFormOpen || editingCandidate) && (
                <CandidateForm 
                    candidate={editingCandidate} 
                    onSave={handleSaveCandidate} 
                    onCancel={() => { setIsFormOpen(false); setEditingCandidate(null); }}
                />
            )}
        </div>
    );
};


// --- DASHBOARD COMPONENT ---

const DashboardCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 transition duration-300 hover:shadow-xl">
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500 uppercase">{title}</p>
            <Icon className={\w-6 h-6 \\} />
        </div>
        <p className="mt-1 text-4xl font-extrabold text-gray-900">{value}</p>
    </div>
);

const AdminDashboard = ({ userId, authReady, onNavigate }) => {
    // Mock Data for Dashboard
    const mockData = {
        totalApplicationsToday: 75,
        recruitersBelow60: 1, 
        interviewsToday: 4,
        assessmentsDue24h: 3,
        pipeline: { onboarding: 15, marketing: 35, interviewing: 12, offered: 3, placed: 1 },
        topPerformers: [
            { name: 'Kartavya', appsToday: 80, targetMet: true },
            { name: 'Satyam', appsToday: 70, targetMet: true },
            { name: 'Pawan', appsToday: 55, targetMet: false },
        ]
    };

    const totalCandidates = mockData.pipeline.onboarding + mockData.pipeline.marketing + mockData.pipeline.interviewing + mockData.pipeline.offered + mockData.pipeline.placed;
    
    // Function to calculate pipeline bar width
    const getPipelineWidth = (count) => totalCandidates > 0 ? \\%\ : '0%';

    return (
        <div className="p-6 md:p-10 font-sans">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Admin Dashboard: Staffing Architect</h1>
            
            <h2 className="text-xl font-semibold text-gray-700 mb-5">Today at a Glance</h2>
            
            {/* Today at a Glance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <DashboardCard title="Apps Today" value={mockData.totalApplicationsToday} icon={Users} colorClass="text-blue-500" />
                <DashboardCard title="Recruiters Below 60" value={mockData.recruitersBelow60} icon={Zap} colorClass="text-red-500" />
                <DashboardCard title="Interviews Today (IST)" value={mockData.interviewsToday} icon={Calendar} colorClass="text-green-500" />
                <DashboardCard title="Assessments Due 24h" value={mockData.assessmentsDue24h} icon={Clock} colorClass="text-yellow-500" />
            </div>

            {/* Pipeline Bars */}
            <Card className="p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Candidate Pipeline Status ({totalCandidates} Total)</h3>
                <div className="space-y-4">
                    {Object.entries(mockData.pipeline).map(([stage, count]) => (
                        <div key={stage}>
                            <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                                <span>{stage.charAt(0).toUpperCase() + stage.slice(1)} ({count})</span>
                                <span>{getPipelineWidth(count)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div 
                                    className={\h-3 rounded-full \\} 
                                    style={{ width: getPipelineWidth(count) }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Top Performers */}
            <h2 className="text-xl font-semibold text-gray-700 mb-5">Top Performers (Today's Apps)</h2>
            <Card className="p-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recruiter</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Apps Sent Today</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {mockData.topPerformers.map((p, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.appsToday} / 60</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={\px-3 py-1 text-xs font-semibold rounded-full \\}>
                                            {p.targetMet ? 'Target Met' : 'Below Target'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};


// --- MAIN APP COMPONENT (Router) ---

const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, role: 'Admin' },
    { name: 'Candidates', href: '/admin/candidates', icon: Users, role: 'Admin' },
    { name: 'Applications', href: '/admin/applications', icon: Briefcase, role: 'Admin' },
    { name: 'Alerts & Reminders', href: '/admin/alerts', icon: Zap, role: 'Admin' },
    { name: 'Reports', href: '/admin/reports', icon: FileText, role: 'Admin' },
];

const Sidebar = ({ isOpen, toggleSidebar, currentPage, onNavigate }) => {
    // Function to handle navigation and update the URL hash
    const handleNavigation = (e, path) => {
        e.preventDefault();
        onNavigate(path);
        if (isOpen) toggleSidebar();
    };

    return (
        <div className={\ixed inset-y-0 left-0 transform \ lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out w-64 bg-gray-900 z-30 flex flex-col shadow-2xl\}>
            <div className="flex items-center justify-between h-20 px-6 border-b border-gray-800">
                <a href="#/admin" onClick={(e) => handleNavigation(e, '/admin')} className="text-2xl font-extrabold text-white flex items-center space-x-2">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <span>Architect</span>
                </a>
                <button onClick={toggleSidebar} className="text-gray-400 lg:hidden p-2 rounded-full hover:bg-gray-700">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = currentPage === item.href;
                    return (
                        <a 
                            key={item.name} 
                            href={\#\\} 
                            onClick={(e) => handleNavigation(e, item.href)} 
                            className={\lex items-center space-x-3 p-3 rounded-xl transition duration-150 \\}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-sm font-medium">{item.name}</span>
                        </a>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-800">
                <a href="#" className="flex items-center space-x-3 p-3 rounded-xl text-gray-400 hover:bg-gray-700 hover:text-white transition duration-150">
                    <Settings className="w-5 h-5" />
                    <span className="text-sm font-medium">Settings</span>
                </a>
                <a href="/logout" className="flex items-center space-x-3 p-3 rounded-xl text-red-400 hover:bg-gray-700 hover:text-red-300 transition duration-150 mt-1">
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Logout</span>
                </a>
            </div>
        </div>
    );
};

// Main App Component
const App = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userId, setUserId] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    
    // Simple Hash-based Router State
    const [currentPage, setCurrentPage] = useState('/admin');

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    
    // 1. Authentication and Initialization
    useEffect(() => {
        if (!auth) return;
        const initializeAuth = async () => {
            try {
                if (initialAuthToken) {
                    const userCredential = await signInWithCustomToken(auth, initialAuthToken);
                    setUserId(userCredential.user.uid);
                } else {
                    const userCredential = await signInAnonymously(auth);
                    setUserId(userCredential.user.uid);
                }
            } catch (error) {
                console.error("Auth error:", error);
                setUserId(crypto.randomUUID()); // Fallback to anonymous ID
            } finally {
                setAuthReady(true);
            }
        };
        initializeAuth();
    }, []);

    // 2. Hash Change Listener for Routing
    useEffect(() => {
        const handleHashChange = () => {
            // Extracts path from hash (e.g., '#/admin/candidates' -> '/admin/candidates')
            const hash = window.location.hash.substring(1) || '/admin';
            // Only update if the hash corresponds to a known route
            const route = navItems.find(item => item.href === hash)?.href || '/admin';
            setCurrentPage(route);
        };
        
        // Initialize route on load
        handleHashChange();

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const handleNavigation = (path) => {
        window.location.hash = path;
    };


    const renderPage = () => {
        const pageProps = { userId, authReady, onNavigate: handleNavigation };
        
        switch (currentPage) {
            case '/admin':
                return <AdminDashboard {...pageProps} />;
            case '/admin/candidates':
                return <CandidatePortal {...pageProps} />;
            // Default page for unimplemented routes
            default:
                return (
                    <div className="p-10 text-center">
                        <h2 className="text-2xl font-bold text-gray-700">Page Coming Soon!</h2>
                        <p className="text-gray-500">The page for **{currentPage}** is under construction.</p>
                        <Button onClick={() => handleNavigation('/admin')} className="mt-4">Go to Dashboard</Button>
                    </div>
                );
        }
    };
    
    return (
        <div className="flex h-screen bg-gray-100 font-inter">
            <Sidebar 
                isOpen={sidebarOpen} 
                toggleSidebar={toggleSidebar} 
                currentPage={currentPage}
                onNavigate={handleNavigation}
            />
            
            {/* Overlay for mobile */}
            {sidebarOpen && <div className="fixed inset-0 bg-black opacity-50 z-20 lg:hidden" onClick={toggleSidebar}></div>}

            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Top Bar for mobile/desktop toggle */}
                <header className="bg-white shadow h-16 flex items-center justify-between px-4 lg:hidden z-10">
                     <button onClick={toggleSidebar} className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-800">Admin Panel</h1>
                    <div></div>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

export default App;
