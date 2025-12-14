import { useNavigate } from 'react-router-dom';
import { HomeIcon } from '@/components/icons';

const Home = () => {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Invoice Generator',
      icon: '📄',
      description: 'Create and print custom invoices for patients',
      path: '/invoice-generator',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Invoice Customizer',
      icon: '✏️',
      description: 'Customize invoice layout and clinic information',
      path: '/invoice-customizer',
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Database Find',
      icon: '🔍',
      description: 'Search and view patient records and treatment history',
      path: '/database-find',
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      title: 'Add Predefined Presets',
      icon: '⚙️',
      description: 'All the predefined presets can be added here',
      path: '/treatment-settings',
      color: 'from-orange-500 to-orange-600'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="bg-white rounded-xl shadow-sm p-8 mb-8 border border-slate-100">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-teal-100 text-teal-700 rounded-xl">
            <HomeIcon />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-slate-800">
              Shree Ram Physiotherapy and Rehabilitation Center
            </h1>
            <p className="text-slate-500 text-lg">Invoice & Patient Management System</p>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div
            key={card.path}
            onClick={() => navigate(card.path)}
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 overflow-hidden group"
          >
            <div className={`h-2 bg-linear-to-r ${card.color}`} />
            <div className="p-8 text-center">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {card.icon}
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">
                {card.title}
              </h2>
              <p className="text-slate-600">{card.description}</p>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default Home;
