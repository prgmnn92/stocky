import {
  Box,
  Flex,
  VStack,
  HStack,
  Icon,
  Text,
  useColorModeValue,
  Drawer,
  DrawerContent,
  useDisclosure,
  IconButton,
  Heading,
  Badge,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Avatar,
} from '@chakra-ui/react'
import {
  FiHome,
  FiTrendingUp,
  FiDollarSign,
  FiTarget,
  FiMenu,
  FiActivity,
  FiMessageSquare,
  FiUsers,
  FiLogOut,
  FiChevronDown,
  FiList,
} from 'react-icons/fi'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useHealth } from '@/hooks/useApiQueries'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  name: string
  icon: any
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: FiHome, path: '/' },
  { name: 'Symbols', icon: FiActivity, path: '/symbols' },
  { name: 'Strategies', icon: FiTarget, path: '/strategies' },
  { name: 'Signals', icon: FiTrendingUp, path: '/signals' },
  { name: 'Positions', icon: FiDollarSign, path: '/positions' },
  { name: 'Transactions', icon: FiList, path: '/transactions' },
  { name: 'Chat', icon: FiMessageSquare, path: '/chat' },
]

export default function Layout() {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <Box minH="100vh" bg={useColorModeValue('gray.100', 'gray.900')}>
      <SidebarContent onClose={() => onClose} display={{ base: 'none', md: 'block' }} />
      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerContent>
          <SidebarContent onClose={onClose} />
        </DrawerContent>
      </Drawer>

      <Box ml={{ base: 0, md: 60 }} p="4">
        <IconButton
          display={{ base: 'flex', md: 'none' }}
          onClick={onOpen}
          variant="outline"
          aria-label="open menu"
          icon={<FiMenu />}
          mb={4}
        />
        <Outlet />
      </Box>
    </Box>
  )
}

interface SidebarProps {
  onClose: () => void
  display?: any
}

const SidebarContent = ({ onClose, ...rest }: SidebarProps) => {
  const { data: health } = useHealth()
  const { user, logout, canManageUsers, canUseChat } = useAuth()
  const isHealthy = health?.status === 'ok'

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'purple'
      case 'MANAGER': return 'blue'
      case 'USER': return 'green'
      case 'TEST_USER': return 'gray'
      default: return 'gray'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Admin'
      case 'MANAGER': return 'Manager'
      case 'USER': return 'User'
      case 'TEST_USER': return 'Test User'
      default: return role
    }
  }

  // Filter nav items based on user role
  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.path === '/chat' && !canUseChat()) return false
    return true
  })

  return (
    <Box
      bg={useColorModeValue('white', 'gray.800')}
      borderRight="1px"
      borderRightColor={useColorModeValue('gray.200', 'gray.700')}
      w={{ base: 'full', md: 60 }}
      pos="fixed"
      h="full"
      {...rest}
    >
      <Flex h="20" alignItems="center" mx="8" justifyContent="space-between">
        <HStack spacing={3}>
          <Icon as={FiTrendingUp} w={8} h={8} color="green.400" />
          <Heading size="md">Stocky</Heading>
        </HStack>
        <Badge colorScheme={isHealthy ? 'green' : 'red'} fontSize="xs">
          {isHealthy ? 'Online' : 'Offline'}
        </Badge>
      </Flex>

      <VStack align="stretch" spacing={1} px={4}>
        {visibleNavItems.map((item) => (
          <NavLink key={item.name} icon={item.icon} path={item.path} onClose={onClose}>
            {item.name}
          </NavLink>
        ))}

        {canManageUsers() && (
          <NavLink icon={FiUsers} path="/users" onClose={onClose}>
            Users
          </NavLink>
        )}
      </VStack>

      <Box pos="absolute" bottom={4} left={4} right={4}>
        <Menu>
          <MenuButton
            as={Button}
            variant="outline"
            w="full"
            rightIcon={<FiChevronDown />}
            size="sm"
          >
            <HStack spacing={2}>
              <Avatar size="xs" name={user?.username} />
              <VStack align="start" spacing={0}>
                <Text fontSize="xs" fontWeight="bold">{user?.username}</Text>
                <Badge colorScheme={getRoleColor(user?.role || '')} fontSize="xx-small">
                  {getRoleLabel(user?.role || '')}
                </Badge>
              </VStack>
            </HStack>
          </MenuButton>
          <MenuList>
            <MenuItem icon={<FiLogOut />} onClick={logout}>
              Logout
            </MenuItem>
          </MenuList>
        </Menu>
      </Box>
    </Box>
  )
}

interface NavLinkProps {
  icon: any
  children: string
  path: string
  onClose: () => void
}

const NavLink = ({ icon, children, path, onClose }: NavLinkProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const isActive = location.pathname === path

  return (
    <Flex
      align="center"
      p="3"
      mx="-1"
      borderRadius="lg"
      role="group"
      cursor="pointer"
      bg={isActive ? 'green.500' : 'transparent'}
      color={isActive ? 'white' : 'inherit'}
      _hover={{
        bg: isActive ? 'green.600' : 'green.500',
        color: 'white',
      }}
      onClick={() => {
        navigate(path)
        onClose()
      }}
    >
      <Icon
        mr="3"
        fontSize="16"
        as={icon}
      />
      <Text fontSize="sm" fontWeight="medium">
        {children}
      </Text>
    </Flex>
  )
}
