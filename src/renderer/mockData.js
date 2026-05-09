// Mock Data — swap with API calls when backend is ready
// Structure: Courses -> Modules -> Videos -> (notes, quiz, exercise)

const MOCK_COURSES = [
  {
    id: 1,
    title: 'Java Full Stack',
    subtitle: 'Core Java to Spring Boot to Microservices',
    icon: 'fab fa-java',
    gradient: 'linear-gradient(135deg,#f97316,#ea580c)',
    rating: 4.9,
    price: 'Rs.999',
    free: false,
    category: 'Programming',
    instructor: 'Rahul Sharma',
    instructorMeta: 'IIT Delhi - 10+ yrs',
    students: '45K',
    hours: 80,
    totalVideos: 120,
    modules: [
      {
        id: 1,
        title: 'Module 1 - Java Basics',
        videos: [
          {
            id: 1,
            title: 'Variables and Data Types',
            duration: '12:30',
            free: true,
            youtubeId: 'eIrMbAQSU34',
            notes: [
              'Variable is a container that stores data',
              'Java is statically typed',
              'Primitives: int, float, double, char, boolean',
              'Reference types: String, Arrays, Objects'
            ],
            quiz: { question: 'Which is NOT a primitive type in Java?', options: ['int', 'String', 'boolean', 'char'], answer: 1 },
            exercise: 'Declare 3 variables (int, String, boolean) and print them.'
          },
          {
            id: 2,
            title: 'OOP Concepts',
            duration: '18:45',
            free: true,
            youtubeId: 'eIrMbAQSU34',
            notes: [
              'OOP stands for Object Oriented Programming',
              '4 pillars: Encapsulation, Inheritance, Polymorphism, Abstraction'
            ],
            quiz: { question: 'Which is a pillar of OOP?', options: ['Compilation', 'Inheritance', 'Looping', 'Indexing'], answer: 1 },
            exercise: 'Create a class Animal with a method sound().'
          },
          {
            id: 3,
            title: 'Inheritance and Polymorphism',
            duration: '22:10',
            free: false,
            youtubeId: 'eIrMbAQSU34',
            notes: [
              'Inheritance allows a class to inherit properties from another',
              'Polymorphism means many forms'
            ],
            quiz: { question: 'Which keyword is used for inheritance in Java?', options: ['implements', 'extends', 'inherits', 'super'], answer: 1 },
            exercise: 'Create Dog class extending Animal.'
          }
        ]
      },
      {
        id: 2,
        title: 'Module 2 - Spring Boot',
        videos: [
          {
            id: 4,
            title: 'Spring Boot Setup',
            duration: '15:00',
            free: false,
            youtubeId: 'eIrMbAQSU34',
            notes: [
              'Spring Boot simplifies Spring configuration',
              'Uses embedded Tomcat server'
            ],
            quiz: { question: 'Spring Boot uses which embedded server by default?', options: ['Jetty', 'Tomcat', 'Nginx', 'Apache'], answer: 1 },
            exercise: 'Create a basic Spring Boot project using Spring Initializr.'
          },
          {
            id: 5,
            title: 'REST API Development',
            duration: '28:20',
            free: false,
            youtubeId: 'eIrMbAQSU34',
            notes: [
              'REST stands for Representational State Transfer',
              'HTTP methods: GET, POST, PUT, DELETE'
            ],
            quiz: { question: 'Which annotation creates a REST controller?', options: ['@Controller', '@RestController', '@Service', '@Component'], answer: 1 },
            exercise: 'Create a /hello GET endpoint that returns Hello World.'
          }
        ]
      }
    ]
  },
  {
    id: 2,
    title: 'MERN Stack Bootcamp',
    subtitle: 'MongoDB, Express, React, Node.js',
    icon: 'fab fa-react',
    gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    rating: 4.8,
    price: 'Rs.799',
    free: false,
    category: 'Web Dev',
    instructor: 'Priya Nair',
    instructorMeta: 'Ex-Google - 8+ yrs',
    students: '32K',
    hours: 70,
    totalVideos: 100,
    modules: [
      {
        id: 1,
        title: 'Module 1 - React Basics',
        videos: [
          {
            id: 1,
            title: 'React Introduction',
            duration: '10:00',
            free: true,
            youtubeId: 'eIrMbAQSU34',
            notes: ['React is a JS library for building UIs', 'Component-based architecture'],
            quiz: { question: 'React was created by?', options: ['Google', 'Facebook', 'Microsoft', 'Twitter'], answer: 1 },
            exercise: 'Create a Hello World React component.'
          }
        ]
      }
    ]
  },
  {
    id: 3,
    title: 'Data Science and ML',
    subtitle: 'Python, Pandas, TensorFlow',
    icon: 'fab fa-python',
    gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
    rating: 4.9,
    price: 'Free',
    free: true,
    category: 'Data Science',
    instructor: 'Amit Verma',
    instructorMeta: 'IIT Bombay - 12+ yrs',
    students: '60K',
    hours: 60,
    totalVideos: 90,
    modules: [
      {
        id: 1,
        title: 'Module 1 - Python Basics',
        videos: [
          {
            id: 1,
            title: 'Python Introduction',
            duration: '8:00',
            free: true,
            youtubeId: 'eIrMbAQSU34',
            notes: ['Python is a high-level language', 'Easy to read and write'],
            quiz: { question: 'Python is which type of language?', options: ['Compiled', 'Interpreted', 'Assembly', 'Machine'], answer: 1 },
            exercise: 'Print Hello World in Python.'
          }
        ]
      }
    ]
  },
  {
    id: 4,
    title: 'DSA and Competitive Prog',
    subtitle: 'Arrays, Trees, Graphs, DP',
    icon: 'fas fa-code',
    gradient: 'linear-gradient(135deg,#10b981,#059669)',
    rating: 4.9,
    price: 'Rs.899',
    free: false,
    category: 'DSA',
    instructor: 'Vikram Singh',
    instructorMeta: 'FAANG - 7+ yrs',
    students: '28K',
    hours: 90,
    totalVideos: 130,
    modules: [
      {
        id: 1,
        title: 'Module 1 - Arrays and Strings',
        videos: [
          {
            id: 1,
            title: 'Arrays Introduction',
            duration: '14:00',
            free: true,
            youtubeId: 'eIrMbAQSU34',
            notes: ['Array is a collection of elements', 'Zero-indexed in most languages'],
            quiz: { question: 'Array index starts from?', options: ['1', '0', '-1', '2'], answer: 1 },
            exercise: 'Find the maximum element in an array.'
          }
        ]
      }
    ]
  },
  {
    id: 5,
    title: 'JavaScript Mastery',
    subtitle: 'ES6+, DOM, Async/Await',
    icon: 'fab fa-js',
    gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
    rating: 4.7,
    price: 'Free',
    free: true,
    category: 'Web Dev',
    instructor: 'Rahul Sharma',
    instructorMeta: 'IIT Delhi - 10+ yrs',
    students: '55K',
    hours: 50,
    totalVideos: 80,
    modules: [
      {
        id: 1,
        title: 'Module 1 - JS Basics',
        videos: [
          {
            id: 1,
            title: 'Variables and Scope',
            duration: '11:00',
            free: true,
            youtubeId: 'eIrMbAQSU34',
            notes: ['var, let, const are variable declarations', 'let and const are block-scoped'],
            quiz: { question: 'Which is block-scoped?', options: ['var', 'let', 'function', 'global'], answer: 1 },
            exercise: 'Demonstrate difference between var and let.'
          }
        ]
      }
    ]
  },
  {
    id: 6,
    title: 'SQL and Database Design',
    subtitle: 'MySQL, PostgreSQL, Indexing',
    icon: 'fas fa-database',
    gradient: 'linear-gradient(135deg,#ec4899,#be185d)',
    rating: 4.8,
    price: 'Rs.599',
    free: false,
    category: 'Programming',
    instructor: 'Neha Gupta',
    instructorMeta: 'Ex-Amazon - 9+ yrs',
    students: '20K',
    hours: 40,
    totalVideos: 60,
    modules: [
      {
        id: 1,
        title: 'Module 1 - SQL Basics',
        videos: [
          {
            id: 1,
            title: 'Introduction to SQL',
            duration: '9:00',
            free: true,
            youtubeId: 'eIrMbAQSU34',
            notes: ['SQL stands for Structured Query Language', 'Used to manage relational databases'],
            quiz: { question: 'SQL stands for?', options: ['Simple Query Language', 'Structured Query Language', 'Standard Query Logic', 'None'], answer: 1 },
            exercise: 'Write a SELECT query to fetch all rows from a table.'
          }
        ]
      }
    ]
  }
];
