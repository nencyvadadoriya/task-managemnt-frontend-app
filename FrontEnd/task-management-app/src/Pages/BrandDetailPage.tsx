import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Building,
    Calendar,
    Activity,
    Edit,
    Search,
    UserPlus,
    UserCheck,
    Eye,
    CheckCircle,
    Loader2,
    Filter,
    Grid,
    List,
    ChevronRight,
    MoreVertical,
    Play,
    Pause,
    Tag,
    MessageSquare,
    History,
    FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

import type { Brand, BrandInvite, UserType, Task } from '../Types/Types';
import InviteToBrandModal from '../Components/InviteToBrandModal';
import { taskService } from '../Services/Task.services';
import { brandService } from '../Services/Brand.service';

interface BrandDetailPageProps {
    brands?: Brand[];
    currentUser?: UserType;
    isSidebarCollapsed?: boolean;
    brandId?: string;
    onBack?: () => void;
    availableUsers?: UserType[];
    onInviteCollaborator?: (invite: BrandInvite) => void;
    tasks?: Task[];
}

const BrandDetailPage: React.FC<BrandDetailPageProps> = ({
    brands = [],
    currentUser = {} as UserType,
    isSidebarCollapsed = false,
    brandId: brandIdProp,
    onBack,
    availableUsers = [],
    onInviteCollaborator,
    tasks: globalTasks = [],
}) => {
    const navigate = useNavigate();
    const { brandId: brandIdFromParams } = useParams<{ brandId: string }>();
    const brandId = brandIdProp || brandIdFromParams;

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'tasks' | 'history'>('tasks');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [assigneeFilter] = useState<string>('all');
    const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [brandLoading, setBrandLoading] = useState(true);
    const [inviteTaskId, setInviteTaskId] = useState<string | null>(null);
    const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<string | null>(null);

    const [localBrand, setLocalBrand] = useState<Brand | null>(null);

    // Get brand from props or API using brandId
    useEffect(() => {
        if (brands.length > 0 && brandId) {
            const foundBrand = brands.find(b => b.id === brandId);
            if (foundBrand) {
                setLocalBrand(foundBrand);
                setBrandLoading(false);
                return;
            }
        }

        if (brandId) {
            const fetchBrandFromAPI = async () => {
                try {
                    setBrandLoading(true);
                    const res = await brandService.getBrandById(brandId);
                    if (res.success && res.data) {
                        setLocalBrand(res.data);
                    }
                } catch (error) {
                    console.error('Error fetching brand from API:', error);
                    toast.error('Failed to load brand details');
                } finally {
                    setBrandLoading(false);
                }
            };

            fetchBrandFromAPI();
        } else {
            setBrandLoading(false);
        }
    }, [brands, brandId]);

    // Helper functions for assignee names - FIXED VERSION
    const getAssignedByName = useCallback((task: Task): string => {
        if ((task as any).assignedByName) {
            return (task as any).assignedByName;
        }

        if (typeof task.assignedBy === 'object' && task.assignedBy !== null) {
            return (task.assignedBy as any).name || 'Unknown';
        }

        if (typeof task.assignedBy === 'string') {
            const user = availableUsers.find(u => u.email === task.assignedBy || u.id === task.assignedBy);
            if (user) return user.name;
            // FIX: Use optional chaining before split
            return task.assignedBy?.split('@')[0] || 'Unknown';
        }

        return 'Unknown';
    }, [availableUsers]);

    const getAssignedToName = useCallback((task: Task): string => {
        if (task.assignedToUser?.name) {
            return task.assignedToUser.name;
        }

        if (typeof task.assignedTo === 'object' && task.assignedTo !== null) {
            return (task.assignedTo as any).name || 'Unknown';
        }

        if (typeof task.assignedTo === 'string') {
            const user = availableUsers.find(u => u.email === task.assignedTo || u.id === task.assignedTo);
            if (user) return user.name;
            // FIX: Use optional chaining before split
            return task.assignedTo?.split('@')[0] || 'Unknown';
        }

        return 'Unknown';
    }, [availableUsers]);

    // Fetch brand tasks
    useEffect(() => {
        if (!localBrand) {
            setTasks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const brandTasks = globalTasks.filter(task =>
                task.brand === localBrand.name ||
                task.company === localBrand.company ||
                String(task.brandId) === String(localBrand.id)
            );

            setTasks(brandTasks);
        } catch (error) {
            console.error('Error loading tasks:', error);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    }, [localBrand, globalTasks]);

    // Calculate brand statistics
    const brandStats = useMemo(() => {
        if (!localBrand) {
            return {
                totalTasks: 0,
                completedTasks: 0,
                pendingTasks: 0,
                inProgressTasks: 0,
                overdueTasks: 0,
                highPriority: 0,
                mediumPriority: 0,
                lowPriority: 0,
            };
        }

        const brandTasks = tasks.filter(task =>
            task.brand === localBrand.name ||
            task.company === localBrand.company ||
            task.brandId === localBrand.id
        );

        return {
            totalTasks: brandTasks.length,
            completedTasks: brandTasks.filter(t => t.status === 'completed').length,
            pendingTasks: brandTasks.filter(t => t.status === 'pending').length,
            inProgressTasks: brandTasks.filter(t => t.status === 'in-progress').length,
            overdueTasks: brandTasks.filter(t => {
                if (t.status === 'completed') return false;
                return new Date(t.dueDate) < new Date();
            }).length,
            highPriority: brandTasks.filter(t => t.priority === 'high').length,
            mediumPriority: brandTasks.filter(t => t.priority === 'medium').length,
            lowPriority: brandTasks.filter(t => t.priority === 'low').length,
        };
    }, [localBrand, tasks]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        if (!localBrand) return [];

        return tasks.filter(task => {
            if (task.brand !== localBrand.name &&
                task.company !== localBrand.company &&
                task.brandId !== localBrand.id) {
                return false;
            }

            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesTitle = task.title?.toLowerCase().includes(searchLower);
                const matchesDescription = task.description?.toLowerCase().includes(searchLower);
                const matchesAssignee = getAssignedToName(task).toLowerCase().includes(searchLower);
                if (!matchesTitle && !matchesDescription && !matchesAssignee) return false;
            }

            // Handle status filter with special case for 'overdue'
            if (statusFilter !== 'all') {
                if (statusFilter === 'overdue') {
                    // Overdue: not completed and due date has passed
                    const isOverdue = task.status !== 'completed' && new Date(task.dueDate) < new Date();
                    if (!isOverdue) return false;
                } else {
                    // Regular status filter
                    if (task.status !== statusFilter) return false;
                }
            }

            if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
            if (assigneeFilter !== 'all' && task.assignedTo !== assigneeFilter) return false;
            if (taskTypeFilter !== 'all' && task.taskType !== taskTypeFilter) return false;

            return true;
        });
    }, [tasks, localBrand, searchTerm, statusFilter, priorityFilter, assigneeFilter, taskTypeFilter, getAssignedToName]);

    // Get ALL task history (for history tab)
    const allTaskHistory = useMemo(() => {
        const allHistory: any[] = [];

        tasks.forEach(task => {
            if (task.history) {
                allHistory.push(...task.history.map(hist => ({
                    ...hist,
                    taskId: task.id,
                    taskTitle: task.title,
                    taskStatus: task.status,
                    brandId: localBrand?.id,
                    brandName: localBrand?.name,
                })));
            }

            // Add task creation as history
            allHistory.push({
                id: `task-created-${task.id}`,
                action: 'task_created',
                description: `Task created: ${task.title}`,
                taskId: task.id,
                taskTitle: task.title,
                taskStatus: task.status,
                userName: getAssignedByName(task),
                timestamp: task.createdAt || new Date().toISOString(),
                brandId: localBrand?.id,
                brandName: localBrand?.name,
            });

            // Add status changes
            if (task.updatedAt && task.createdAt !== task.updatedAt) {
                allHistory.push({
                    id: `task-updated-${task.id}`,
                    action: 'task_updated',
                    description: `Task updated: ${task.title}`,
                    taskId: task.id,
                    taskTitle: task.title,
                    taskStatus: task.status,
                    userName: getAssignedByName(task),
                    timestamp: task.updatedAt,
                    brandId: localBrand?.id,
                    brandName: localBrand?.name,
                });
            }
        });

        return allHistory.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }, [tasks, getAssignedByName, localBrand]);

    // Get specific task history (when a task is selected)
    const selectedTaskHistory = useMemo(() => {
        if (!selectedTaskForHistory) return [];

        const task = tasks.find(t => t.id === selectedTaskForHistory);
        if (!task) return [];

        const taskHistory: any[] = [];

        // Add task history
        if (task.history) {
            taskHistory.push(...task.history.map(hist => ({
                ...hist,
                taskId: task.id,
                taskTitle: task.title,
                taskStatus: task.status,
                brandId: localBrand?.id,
                brandName: localBrand?.name,
            })));
        }

        // Add task creation
        taskHistory.push({
            id: `task-created-${task.id}`,
            action: 'task_created',
            description: `Task created: ${task.title}`,
            taskId: task.id,
            taskTitle: task.title,
            taskStatus: task.status,
            userName: getAssignedByName(task),
            timestamp: task.createdAt || new Date().toISOString(),
            brandId: localBrand?.id,
            brandName: localBrand?.name,
        });

        // Add updates
        if (task.updatedAt && task.createdAt !== task.updatedAt) {
            taskHistory.push({
                id: `task-updated-${task.id}`,
                action: 'task_updated',
                description: `Task updated: ${task.title}`,
                taskId: task.id,
                taskTitle: task.title,
                taskStatus: task.status,
                userName: getAssignedByName(task),
                timestamp: task.updatedAt,
                brandId: localBrand?.id,
                brandName: localBrand?.name,
            });
        }

        return taskHistory.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }, [selectedTaskForHistory, tasks, getAssignedByName, localBrand]);

    // Get displayed history based on selection
    const displayedHistory = useMemo(() => {
        return selectedTaskForHistory ? selectedTaskHistory : allTaskHistory;
    }, [selectedTaskForHistory, selectedTaskHistory, allTaskHistory]);

    const getStatusColor = useCallback((status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800 border-green-200';
            case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    }, []);

    const getPriorityColor = useCallback((priority: string | undefined) => {
        switch (priority) {
            case 'high': return 'bg-red-100 text-red-800 border-red-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200'; // default for undefined
        }
    }, []);

    const getActionIcon = useCallback((action: string) => {
        switch (action) {
            case 'task_created': return <FileText className="h-4 w-4" />;
            case 'task_completed': return <CheckCircle className="h-4 w-4" />;
            case 'task_updated': return <Edit className="h-4 w-4" />;
            case 'status_changed': return <Activity className="h-4 w-4" />;
            case 'comment_added': return <MessageSquare className="h-4 w-4" />;
            default: return <Activity className="h-4 w-4" />;
        }
    }, []);

    const handleInviteCollaborator = useCallback((taskId?: string) => {
        if (taskId && typeof taskId === 'string') {
            setInviteTaskId(taskId);
        } else {
            setInviteTaskId(null);
        }
        setShowInviteModal(true);
    }, []);

    const handleCloseInviteModal = useCallback(() => {
        setShowInviteModal(false);
        setInviteTaskId(null);
    }, []);

    const handleInvite = useCallback(async (invite: BrandInvite) => {
        if (inviteTaskId) {
            const result = await taskService.inviteToTask(inviteTaskId, invite.email, invite.role);
            if (result.success) {
                toast.success('User invited to task successfully');
            } else {
                toast.error(result.message);
            }
            setShowInviteModal(false);
            setInviteTaskId(null);
            return;
        }

        if (onInviteCollaborator) {
            onInviteCollaborator(invite);
        }

        toast.success(`Invitation sent to ${invite.email}`);
        setShowInviteModal(false);
    }, [onInviteCollaborator, inviteTaskId]);

    const handleBack = useCallback(() => {
        if (onBack) {
            onBack();
            return;
        }
        navigate('/brands');
    }, [navigate, onBack]);

    const handleViewTask = useCallback((taskId: string) => {
        navigate(`/task/${taskId}`);
    }, [navigate]);

    const handleTaskAction = useCallback(async (taskId: string, action: 'start' | 'pause' | 'complete') => {
        try {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            let newStatus = task.status;
            switch (action) {
                case 'start':
                    newStatus = 'in-progress';
                    break;
                case 'pause':
                    newStatus = 'pending';
                    break;
                case 'complete':
                    newStatus = 'completed';
                    break;
            }

            // Use updateTask method with the updated task object
            const result = await taskService.updateTask(taskId, {
                ...task,
                status: newStatus
            });

            if (result.success) {
                toast.success(`Task ${action}ed successfully`);
                // Update local task state
                setTasks(prev => prev.map(t =>
                    t.id === taskId ? { ...t, status: newStatus } : t
                ));
            } else {
                toast.error(result.message || 'Failed to update task');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            toast.error('Failed to update task');
        }
    }, [tasks]);

    const handleViewTaskHistory = useCallback((taskId: string) => {
        setSelectedTaskForHistory(taskId);
        setActiveTab('history');
    }, []);

    const handleViewAllHistory = useCallback(() => {
        setSelectedTaskForHistory(null);
        setActiveTab('history');
    }, []);

    const containerClasses = useMemo(() => {
        return `w-full max-w-full mx-auto px-4 sm:px-6 md:px-8 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:px-6' : 'lg:px-8'}`;
    }, [isSidebarCollapsed]);

    if (brandLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (!localBrand) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-12">
                <div className="text-center">
                    <Building className="h-16 w-16 text-gray-300 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Brand not found</h3>
                    <button onClick={handleBack} className="inline-flex items-center text-blue-600 font-bold hover:underline">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Brands
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                <div className={containerClasses}>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between py-6 gap-4">
                        <div className="flex items-center gap-5">
                            <button onClick={handleBack} className="p-2 bg-gray-100 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-4">
                                {localBrand.logo ? (
                                    <img src={localBrand.logo} alt={localBrand.name} className="h-12 w-12 rounded-xl object-cover border border-gray-200" />
                                ) : (
                                    <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white">
                                        <Building className="h-6 w-6" />
                                    </div>
                                )}
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">{localBrand.name}</h1>
                                    <p className="text-gray-500 text-sm">{localBrand.company} • {brandStats.totalTasks} Tasks</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-8">
                        {['tasks', 'history'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab as any);
                                    if (tab === 'history') {
                                        setSelectedTaskForHistory(null);
                                    }
                                }}
                                className={`py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                {tab === 'history' && <History className="h-4 w-4" />}
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {tab === 'history' && displayedHistory.length > 0 && (
                                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                                        {displayedHistory.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className={containerClasses}>
                <div className="py-8">
                    {activeTab === 'tasks' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Side - Tasks (2/3 width) */}
                            <div className="lg:col-span-2">
                                {/* Stats Row - Clickable Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className={`bg-white p-4 rounded-xl border-2 shadow-sm text-left transition-all hover:shadow-md ${statusFilter === 'all' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <p className="text-xs text-gray-500 font-medium mb-1">Total Tasks</p>
                                        <p className="text-2xl font-bold text-gray-900">{brandStats.totalTasks}</p>
                                        {statusFilter === 'all' && (
                                            <p className="text-xs text-blue-600 font-medium mt-1">● Active Filter</p>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('completed')}
                                        className={`bg-white p-4 rounded-xl border-2 shadow-sm text-left transition-all hover:shadow-md ${statusFilter === 'completed' ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <p className="text-xs text-gray-500 font-medium mb-1">Completed</p>
                                        <p className="text-2xl font-bold text-green-600">{brandStats.completedTasks}</p>
                                        {statusFilter === 'completed' && (
                                            <p className="text-xs text-green-600 font-medium mt-1">● Active Filter</p>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('in-progress')}
                                        className={`bg-white p-4 rounded-xl border-2 shadow-sm text-left transition-all hover:shadow-md ${statusFilter === 'in-progress' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <p className="text-xs text-gray-500 font-medium mb-1">In Progress</p>
                                        <p className="text-2xl font-bold text-blue-600">{brandStats.inProgressTasks}</p>
                                        {statusFilter === 'in-progress' && (
                                            <p className="text-xs text-blue-600 font-medium mt-1">● Active Filter</p>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('overdue')}
                                        className={`bg-white p-4 rounded-xl border-2 shadow-sm text-left transition-all hover:shadow-md ${statusFilter === 'overdue' ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <p className="text-xs text-gray-500 font-medium mb-1">Overdue</p>
                                        <p className="text-2xl font-bold text-red-600">{brandStats.overdueTasks}</p>
                                        {statusFilter === 'overdue' && (
                                            <p className="text-xs text-red-600 font-medium mt-1">● Active Filter</p>
                                        )}
                                    </button>
                                </div>

                                {/* Filters Section */}
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
                                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search tasks..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setViewMode('grid')}
                                                    className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}
                                                >
                                                    <Grid className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('list')}
                                                    className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}
                                                >
                                                    <List className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4 text-gray-500" />
                                            <select
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            >
                                                <option value="all">All Status</option>
                                                <option value="pending">Pending</option>
                                                <option value="in-progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                                <option value="overdue">Overdue</option>
                                            </select>
                                            <select
                                                value={priorityFilter}
                                                onChange={(e) => setPriorityFilter(e.target.value)}
                                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            >
                                                <option value="all">All Priority</option>
                                                <option value="high">High</option>
                                                <option value="medium">Medium</option>
                                                <option value="low">Low</option>
                                            </select>
                                            <select
                                                value={taskTypeFilter}
                                                onChange={(e) => setTaskTypeFilter(e.target.value)}
                                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            >
                                                <option value="all">All Types</option>
                                                <option value="regular">Regular</option>
                                                <option value="troubleshoot">Troubleshoot</option>
                                                <option value="maintenance">Maintenance</option>
                                                <option value="development">Development</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Tasks Grid/List */}
                                {loading ? (
                                    <div className="flex items-center justify-center h-64">
                                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                                    </div>
                                ) : filteredTasks.length > 0 ? (
                                    viewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredTasks.map((task) => (
                                                <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h3 className="font-semibold text-gray-900 mb-1">{task.title}</h3>
                                                            <p className="text-sm text-gray-500 line-clamp-2">{task.description}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleViewTaskHistory(task.id)}
                                                                className="text-gray-400 hover:text-blue-600 p-1"
                                                                title="View History"
                                                            >
                                                                <History className="h-4 w-4" />
                                                            </button>
                                                            <button className="text-gray-400 hover:text-gray-600 p-1">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                                                            {task.status}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority || 'low')}`}>
                                                            {task.priority}
                                                        </span>
                                                        {task.taskType && (
                                                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                                <Tag className="h-3 w-3 inline mr-1" />
                                                                {task.taskType}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                                                <Calendar className="h-4 w-4" />
                                                                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                                                <UserCheck className="h-4 w-4" />
                                                                <span>{getAssignedToName(task)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {task.status === 'pending' && (
                                                                <button
                                                                    onClick={() => handleTaskAction(task.id, 'start')}
                                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                                    title="Start Task"
                                                                >
                                                                    <Play className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            {task.status === 'in-progress' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleTaskAction(task.id, 'pause')}
                                                                        className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                                                                        title="Pause Task"
                                                                    >
                                                                        <Pause className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleTaskAction(task.id, 'complete')}
                                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                                                        title="Complete Task"
                                                                    >
                                                                        <CheckCircle className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={() => handleViewTask(task.id)}
                                                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                                                                title="View Details"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleInviteCollaborator(task.id)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                                title="Invite to Task"
                                                            >
                                                                <UserPlus className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Task</th>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Status</th>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Priority</th>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Due Date</th>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Assignee</th>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {filteredTasks.map((task) => (
                                                        <tr key={task.id} className="hover:bg-gray-50">
                                                            <td className="py-3 px-4">
                                                                <div>
                                                                    <div className="font-medium text-gray-900">{task.title}</div>
                                                                    <div className="text-sm text-gray-500 truncate max-w-xs">{task.description}</div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                                                                    {task.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority || 'low')}`}>
                                                                    {task.priority}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-sm text-gray-700">
                                                                {new Date(task.dueDate).toLocaleDateString()}
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <div className="text-sm font-medium text-gray-900">{getAssignedToName(task)}</div>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleViewTaskHistory(task.id)}
                                                                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                                                                        title="View History"
                                                                    >
                                                                        <History className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleViewTask(task.id)}
                                                                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                                                                        title="View Details"
                                                                    >
                                                                        <Eye className="h-4 w-4" />
                                                                    </button>
                                                                    {task.status === 'pending' && (
                                                                        <button
                                                                            onClick={() => handleTaskAction(task.id, 'start')}
                                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                                            title="Start Task"
                                                                        >
                                                                            <Play className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleInviteCollaborator(task.id)}
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                                        title="Invite to Task"
                                                                    >
                                                                        <UserPlus className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                ) : (
                                    <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
                                        <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
                                        <p className="text-gray-500">Try adjusting your filters or search terms</p>
                                    </div>
                                )}
                            </div>

                            {/* Right Side - Task History Summary (1/3 width) */}
                            <div className="lg:col-span-1">
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm sticky top-24">
                                    <div className="p-6 border-b border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                                            <button
                                                onClick={handleViewAllHistory}
                                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                            >
                                                View All <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">Latest updates across all tasks</p>
                                    </div>

                                    <div className="p-4">
                                        <div className="space-y-4 max-h-[600px] overflow-y-auto">
                                            {allTaskHistory.slice(0, 5).length > 0 ? (
                                                allTaskHistory.slice(0, 5).map((item, index) => (
                                                    <div key={`${item.id}-${index}`} className="relative pb-4 pl-8">
                                                        <div className="absolute left-3 top-2 h-3 w-3 rounded-full bg-blue-500 border-2 border-white"></div>
                                                        {index < 4 && (
                                                            <div className="absolute left-[17px] top-5 bottom-0 w-0.5 bg-gray-200"></div>
                                                        )}

                                                        <div className="bg-gray-50 rounded-lg p-3">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className={`p-1 rounded ${item.action === 'task_created' ? 'bg-green-100 text-green-600' : item.action === 'task_completed' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {getActionIcon(item.action)}
                                                                </div>
                                                                <span className="text-sm font-medium text-gray-900">{item.userName}</span>
                                                                <span className="text-xs text-gray-500">
                                                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>

                                                            <p className="text-sm text-gray-700 mb-1">{item.description}</p>

                                                            <div className="flex items-center justify-between mt-2">
                                                                <span className="text-xs font-medium text-gray-900 px-2 py-1 bg-white rounded border border-gray-200">
                                                                    {item.taskTitle}
                                                                </span>
                                                                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.taskStatus)}`}>
                                                                    {item.taskStatus}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8">
                                                    <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                                    <p className="text-gray-500">No activity yet</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700">Completed Tasks</span>
                                                <span className="text-sm font-semibold text-gray-900">{brandStats.completedTasks}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700">In Progress</span>
                                                <span className="text-sm font-semibold text-gray-900">{brandStats.inProgressTasks}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700">Pending</span>
                                                <span className="text-sm font-semibold text-gray-900">{brandStats.pendingTasks}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700">Overdue</span>
                                                <span className="text-sm font-semibold text-red-600">{brandStats.overdueTasks}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // History Tab - Full Width History View
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-900">
                                            {selectedTaskForHistory ? 'Task History' : 'All Task History'}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {selectedTaskForHistory
                                                ? `Showing history for selected task`
                                                : `Showing all activities across ${tasks.length} tasks`
                                            }
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {selectedTaskForHistory && (
                                            <button
                                                onClick={() => setSelectedTaskForHistory(null)}
                                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                            >
                                                <ArrowLeft className="h-4 w-4" /> View All History
                                            </button>
                                        )}
                                        <div className="text-sm text-gray-500">
                                            {displayedHistory.length} activities
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="space-y-6">
                                    {displayedHistory.length > 0 ? (
                                        displayedHistory.map((item, index) => (
                                            <div key={`${item.id}-${index}`} className="relative pb-6 pl-10">
                                                <div className="absolute left-4 top-2 h-4 w-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
                                                    {getActionIcon(item.action)}
                                                </div>
                                                {index < displayedHistory.length - 1 && (
                                                    <div className="absolute left-[23px] top-6 bottom-0 w-0.5 bg-gray-200"></div>
                                                )}

                                                <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`px-2 py-1 rounded text-xs font-medium ${item.action === 'task_created' ? 'bg-green-100 text-green-600' : item.action === 'task_completed' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {/* FIX: Safe replace method */}
                                                                    {item.action?.replace(/_/g, ' ') || 'unknown'}
                                                                </div>
                                                                <span className="text-sm font-medium text-gray-900">{item.userName}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(item.timestamp).toLocaleDateString()}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <p className="text-sm text-gray-700 mb-3">{item.description}</p>

                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium text-gray-600">Task:</span>
                                                            <span className="text-sm font-medium text-gray-900 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                                                                {item.taskTitle}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium text-gray-600">Status:</span>
                                                            <span className={`text-sm px-3 py-1.5 rounded-lg font-medium ${getStatusColor(item.taskStatus)}`}>
                                                                {item.taskStatus}
                                                            </span>
                                                        </div>
                                                        {!selectedTaskForHistory && (
                                                            <button
                                                                onClick={() => handleViewTaskHistory(item.taskId)}
                                                                className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                                            >
                                                                View Task History
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12">
                                            <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                            <h4 className="text-lg font-medium text-gray-900 mb-2">No history found</h4>
                                            <p className="text-gray-500">
                                                {selectedTaskForHistory
                                                    ? 'No history available for this task'
                                                    : 'No activity history available'
                                                }
                                            </p>
                                            {selectedTaskForHistory && (
                                                <button
                                                    onClick={() => setSelectedTaskForHistory(null)}
                                                    className="mt-4 text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
                                                >
                                                    <ArrowLeft className="h-4 w-4" /> Back to All History
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <InviteToBrandModal
                    show={showInviteModal}
                    brand={localBrand}
                    currentUser={currentUser}
                    availableUsers={availableUsers}
                    onClose={handleCloseInviteModal}
                    onInvite={handleInvite}
                />
            )}
        </div>
    );
};

export default BrandDetailPage;