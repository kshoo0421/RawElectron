#include <rawelectron/ipc/engine_bridge.hpp>

namespace rawelectron::ipc {

engine::EngineInfo get_engine_info() {
  return engine::EngineApi{}.info();
}

}  // namespace rawelectron::ipc
